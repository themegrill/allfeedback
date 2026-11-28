<?php
/**
 * Submit controller.
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\API\Controllers\V1;

defined( 'ABSPATH' ) || exit;

use AllFeedback\API\RestController;
use AllFeedback\Application\Response\ResponseDTO;
use AllFeedback\Application\Response\SubmitResponseService;
use AllFeedback\Core\Exceptions\NotFoundException;
use AllFeedback\Core\Exceptions\ValidationException;
use AllFeedback\Core\Settings\SettingsManager;
use AllFeedback\Domain\Analytics\SurveySession;
use AllFeedback\Domain\Analytics\SurveySessionRepository;
use AllFeedback\Domain\Response\ResponseRepository;
use AllFeedback\Domain\Survey\SurveyRepository;
use AllFeedback\Support\Logger;

/**
 * Class SubmitController
 *
 * Handles the public-facing survey submission endpoint.
 *
 * Route registered (under allfeedback/v1):
 *   POST /surveys/{id}/submit → handle() : public widget submission
 *
 * Intentionally separate from ResponsesController (admin read/delete) to
 * enforce a clear security boundary: this controller is public-permission
 * (nonce-gated), all others require manage_options.
 *
 * Submission flow:
 *   1. Nonce verification.
 *   2. Survey existence + published-status guard.
 *   3. Duplicate IP detection (HMAC-SHA256, no raw IP stored).
 *   4. `allfeedback_allow_response_submission` filter — pro blocking hooks.
 *   5. `allfeedback_response_data_before_save` filter — data transformation.
 *   6. Delegate to SubmitResponseService, which runs the validation pipeline,
 *      persists the response, and fires `allfeedback_response_submitted` to
 *      trigger the async notification pipeline (admin alert + respondent email).
 *   7. `allfeedback_response_submitted` action — third-party side-effects.
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */
class SubmitController extends RestController {

	/**
	 * REST resource slug.
	 *
	 * @var string
	 * @since 1.0.0
	 */
	protected string $rest_base = 'surveys';

	/**
	 * Nonce action used to authenticate public widget submissions.
	 *
	 * @since 1.0.0
	 */
	public const NONCE_ACTION = 'allfeedback_submit';

	/**
	 * Constructor.
	 *
	 * @param  SurveyRepository        $survey_repository   Survey repository for existence and status checks.
	 * @param  ResponseRepository      $response_repository Response repository for duplicate detection.
	 * @param  SubmitResponseService   $submit_service      Use-case service for response submission.
	 * @param  SettingsManager         $settings_manager    Settings for privacy flags.
	 * @param  Logger                  $logger             Structured logger.
	 * @param  SurveySessionRepository $session_repository  Session repository for analytics.
	 * @since  1.0.0
	 */
	public function __construct(
		private readonly SurveyRepository $survey_repository,
		private readonly ResponseRepository $response_repository,
		private readonly SubmitResponseService $submit_service,
		private readonly SettingsManager $settings_manager,
		private readonly Logger $logger,
		private readonly SurveySessionRepository $session_repository,
	) {}

	/**
	 * Register all routes for this controller.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function registerRoutes(): void {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/submit',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle' ],
				'permission_callback' => [ $this, 'publicPermission' ],
				'args'                => array_merge( $this->idArg(), $this->submitArgs() ),
			]
		);
	}

	/**
	 * POST /allfeedback/v1/surveys/{id}/submit
	 *
	 * Accept and persist a public widget submission.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function handle( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$nonce = sanitize_text_field( (string) ( $request->get_param( 'nonce' ) ?? '' ) );

		if ( ! wp_verify_nonce( $nonce, self::NONCE_ACTION ) ) {
			$this->logger->warning(
				'Submission rejected: invalid nonce.',
				[ 'survey_id' => (int) $request->get_param( 'id' ) ]
			);
			return $this->errorResponse( __( 'Invalid or expired nonce.', 'allfeedback' ), 403 );
		}

		[ $ip_hash, $raw_ip ] = $this->resolveClientIp();

		if ( ! $this->checkRateLimit( $ip_hash ) ) {
			$this->logger->warning( 'Submission rejected: rate limit exceeded.', [ 'survey_id' => (int) $request->get_param( 'id' ) ] );
			return $this->errorResponse( __( 'Too many submissions. Please wait before trying again.', 'allfeedback' ), 429 );
		}

		$survey_id = (int) $request->get_param( 'id' );
		$survey    = $this->survey_repository->findById( $survey_id );

		if ( $survey === null ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		$is_draft         = $survey->getStatus()->value === 'draft';
		$is_inactive      = [] !== $survey->getMissingFeatures();
		$is_admin_preview = ( $is_draft || $is_inactive ) && current_user_can( 'manage_options' );

		if ( ! $survey->isLive() && ! $is_admin_preview ) {
			$this->logger->warning(
				'Submission rejected: survey not published.',
				[
					'survey_id' => $survey_id,
					'status' => $survey->getStatus()->value,
				]
			);
			return $this->errorResponse( __( 'This survey is not currently accepting responses.', 'allfeedback' ), 403 );
		}

		if ( ! (bool) apply_filters( 'allfeedback_allow_response_submission', true, $survey_id, $survey, $request ) ) {
			$this->logger->warning( 'Submission blocked by filter.', [ 'survey_id' => $survey_id ] );
			return $this->errorResponse( __( 'Response submission is not allowed.', 'allfeedback' ), 403 );
		}

		$disable_user_details = (bool) $this->settings_manager->get( 'advanced.privacy.disable_user_details' );

		if ( ! $disable_user_details && ! current_user_can( 'manage_options' ) ) {
			$duplicate_window_hours = max( 0, (int) apply_filters( 'allfeedback_duplicate_window_hours', 0, $survey_id ) );
			$user_id                = get_current_user_id();

			if ( $user_id > 0 ) {
				if ( $this->response_repository->existsByUserId( $survey_id, $user_id, $duplicate_window_hours ) ) {
					$this->logger->debug(
						'Duplicate submission blocked (user_id).',
						[
							'survey_id' => $survey_id,
							'user_id' => $user_id,
						]
					);
					return $this->errorResponse( __( 'A response from this user has already been recorded.', 'allfeedback' ), 409 );
				}
			} else {
				$visitor_token = sanitize_text_field( (string) ( $request->get_param( 'visitor_token' ) ?? '' ) );

				if ( $visitor_token !== '' ) {
					if ( $this->response_repository->existsByGuestToken( $survey_id, $visitor_token, $duplicate_window_hours ) ) {
						$this->logger->debug( 'Duplicate submission blocked (guest_token).', [ 'survey_id' => $survey_id ] );
						return $this->errorResponse( __( 'A response from this visitor has already been recorded.', 'allfeedback' ), 409 );
					}
				} elseif ( $ip_hash !== '' ) {
					if ( $this->response_repository->existsByIpHash( $survey_id, $ip_hash, $duplicate_window_hours ) ) {
						$this->logger->debug( 'Duplicate submission blocked (ip_hash).', [ 'survey_id' => $survey_id ] );
						return $this->errorResponse( __( 'A response from this visitor has already been recorded.', 'allfeedback' ), 409 );
					}
				}
			}
		}

		$response_data = $this->sanitizeResponseData(
			(array) apply_filters(
				'allfeedback_response_data_before_save',
				(array) ( $request->get_param( 'response_data' ) ?? [] ),
				$survey_id,
				$survey
			)
		);

		$dto = ResponseDTO::fromArray(
			$survey_id,
			array_merge( $request->get_params(), [ 'response_data' => $response_data ] )
		);

		try {
			$domain_response = $this->submit_service->execute( $dto, $ip_hash, $disable_user_details ? null : $raw_ip );
		} catch ( ValidationException $e ) {
			return $this->exceptionToResponse( $e );
		} catch ( NotFoundException $e ) {
			return $this->exceptionToResponse( $e );
		}

		$response_id = (int) $domain_response->getId();

		$session_id = sanitize_text_field( (string) ( $request->get_param( 'session_id' ) ?? '' ) );
		if ( $session_id !== '' ) {
			$now     = new \DateTimeImmutable();
			$session = $this->session_repository->findBySessionId( $session_id );
			if ( $session === null ) {
				$submit_user_id_raw  = get_current_user_id();
				$submit_user_id      = $submit_user_id_raw !== 0 ? $submit_user_id_raw : null;
				$submit_guest_id_raw = sanitize_text_field( (string) ( $request->get_param( 'visitor_token' ) ?? '' ) );
				$submit_guest_id     = $submit_guest_id_raw !== '' ? $submit_guest_id_raw : null;
				$session             = new SurveySession(
					survey_id:  $survey_id,
					session_id: $session_id,
					user_id:    $submit_user_id,
					guest_id:   $submit_guest_id,
				);
			}
			if ( ! $session->isSubmitted() ) {
				$session->markSubmitted( $now );
				$this->session_repository->save( $session );
			}
		}

		do_action( 'allfeedback_response_submitted', $response_id, $survey_id, $survey );

		$this->logger->info(
			'Survey response submitted.',
			[
				'response_id' => $response_id,
				'survey_id'   => $survey_id,
				'score'       => $request->get_param( 'score' ),
				'anonymous'   => ! is_user_logged_in(),
			]
		);

		return $this->successResponse( [ 'id' => $response_id ], 201 );
	}

	/**
	 * Rate-limit submissions by IP hash using a transient counter.
	 *
	 * Allows a maximum of `allfeedback_submit_rate_limit` submissions (default 10)
	 * per IP within a 5-minute window.
	 *
	 * @param  string $ip_hash HMAC hash of the visitor IP.
	 * @return bool True when under the limit; false when exceeded.
	 * @since  1.0.0
	 */
	private function checkRateLimit( string $ip_hash ): bool {
		$limit = max( 1, (int) apply_filters( 'allfeedback_submit_rate_limit', 10 ) );
		$key   = 'allfeedback_rl_' . substr( $ip_hash, 0, 16 );
		$count = (int) get_transient( $key );

		if ( $count >= $limit ) {
			return false;
		}

		set_transient( $key, $count + 1, 5 * MINUTE_IN_SECONDS );
		return true;
	}

	/**
	 * Recursively sanitise the response_data array.
	 *
	 * Strips HTML from all string values so that arbitrary markup submitted by
	 * a visitor is never stored in the database. Numeric and boolean values are
	 * left as-is; nested arrays are processed recursively. Unknown types are
	 * dropped silently.
	 *
	 * @param  array<mixed> $data Raw response_data payload.
	 * @return array<mixed> Sanitised payload.
	 * @since  1.0.0
	 */
	private function sanitizeResponseData( array $data ): array {
		$clean = [];
		foreach ( $data as $key => $value ) {
			$key = is_string( $key ) ? sanitize_text_field( $key ) : (int) $key;
			if ( is_array( $value ) ) {
				$clean[ $key ] = $this->sanitizeResponseData( $value );
			} elseif ( is_string( $value ) ) {
				$clean[ $key ] = sanitize_text_field( $value );
			} elseif ( is_int( $value ) || is_float( $value ) || is_bool( $value ) || $value === null ) {
				$clean[ $key ] = $value;
			}
		}
		return $clean;
	}

	/**
	 * Body arguments for the public submission endpoint.
	 *
	 * @return array<string, array<string, mixed>>
	 * @since  1.0.0
	 */
	private function submitArgs(): array {
		return [
			'nonce'         => $this->argString(
				description: __( 'WordPress nonce for submission authentication (action: allfeedback_submit).', 'allfeedback' ),
				required:    true,
			),
			'response_data' => [
				'description'       => __( 'Field answers keyed by field ID.', 'allfeedback' ),
				'type'              => 'object',
				'required'          => true,
				'validate_callback' => 'rest_validate_request_arg',
			],
			'score'         => $this->argInteger(
				description: __( 'Numeric score for NPS or star-rating fields.', 'allfeedback' ),
				min:         0,
				max:         100,
			),
			'page_url'      => $this->argString(
				description: __( 'URL of the page where the survey was displayed.', 'allfeedback' ),
				max_length:   2083,
			),
			'device_type'   => $this->argEnum(
				description: __( 'Visitor device type at submission time.', 'allfeedback' ),
				values:      [ 'desktop', 'tablet', 'mobile' ],
			),
			'consent_given' => $this->argBoolean(
				description: __( 'Whether the visitor gave GDPR data-processing consent.', 'allfeedback' ),
				default:     false,
			),
			'visitor_token' => $this->argString(
				description: __( 'Persistent guest visitor UUID (v4) for duplicate detection.', 'allfeedback' ),
				max_length:   36,
			),
			'session_id'    => $this->argString(
				description: __( 'Analytics session UUID (v4) generated on widget open.', 'allfeedback' ),
				max_length:   36,
			),
		];
	}
}
