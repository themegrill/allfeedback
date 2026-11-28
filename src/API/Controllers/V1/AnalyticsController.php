<?php
/**
 * Analytics controller.
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\API\Controllers\V1;

defined( 'ABSPATH' ) || exit;

use AllFeedback\API\RestController;
use AllFeedback\Application\Analytics\TrackSessionEventService;
use AllFeedback\Domain\Analytics\SurveySessionRepository;
use AllFeedback\Domain\Survey\SurveyRepository;

/**
 * REST controller for survey session analytics.
 *
 * Routes (under `allfeedback/v1`):
 *   `POST /surveys/{id}/analytics/event` — public; track a single session event.
 *   `GET  /surveys/{id}/analytics`       — admin; return aggregate metrics.
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */
class AnalyticsController extends RestController {

	/**
	 * Route base for survey resources.
	 *
	 * @var string
	 * @since 1.0.0
	 */
	protected string $rest_base = 'surveys';

	/**
	 * Constructor.
	 *
	 * @param  TrackSessionEventService $track_service       Use-case service for recording events.
	 * @param  SurveySessionRepository  $session_repository  Session repository for aggregate queries.
	 * @since  1.0.0
	 */
	public function __construct(
		private readonly TrackSessionEventService $track_service,
		private readonly SurveySessionRepository $session_repository,
	) {}

	/**
	 * Register all REST routes for this controller.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function registerRoutes(): void {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/analytics/event',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'trackEvent' ],
				'permission_callback' => [ $this, 'publicPermission' ],
				'args'                => array_merge( $this->idArg(), $this->eventArgs() ),
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/analytics',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'getAnalytics' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => $this->idArg(),
			]
		);
	}

	/**
	 * Handle `POST /surveys/{id}/analytics/event`.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function trackEvent( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$survey_id    = (int) $request->get_param( 'id' );
		$event        = sanitize_key( (string) $request->get_param( 'event' ) );
		$session_id   = sanitize_text_field( (string) ( $request->get_param( 'session_id' ) ?? '' ) );
		$guest_id_raw = sanitize_text_field( (string) ( $request->get_param( 'guest_id' ) ?? '' ) );
		$guest_id     = $guest_id_raw !== '' ? $guest_id_raw : null;
		$user_id_raw  = get_current_user_id();
		$user_id      = $user_id_raw !== 0 ? $user_id_raw : null;

		if ( $session_id === '' ) {
			return $this->errorResponse( __( 'session_id is required.', 'allfeedback' ), 400 );
		}

		if ( ! $this->checkAnalyticsRateLimit( $session_id ) || ! $this->checkIpRateLimit() ) {
			return $this->successResponse( null );
		}

		// Resolved here, not injected, so sites holding a compiled DI container for this version keep booting.
		$survey = allfeedback_get_plugin_instance()->getContainer()->get( SurveyRepository::class )->findById( $survey_id );

		if ( $survey === null || ( ! $survey->isLive() && ! current_user_can( 'manage_options' ) ) ) {
			return $this->successResponse( null );
		}

		$this->track_service->execute( $survey_id, $event, $session_id, $user_id, $guest_id );

		return $this->successResponse( null );
	}

	/**
	 * Rate-limit analytics events per session to prevent data poisoning.
	 *
	 * A session may fire at most `allfeedback_analytics_rate_limit` events
	 * (default 60) per 5-minute window. Excess events are silently dropped so
	 * the widget's UX is unaffected.
	 *
	 * @param  string $session_id Client-generated session UUID.
	 * @return bool True when under the limit; false when exceeded.
	 * @since  1.0.0
	 */
	private function checkAnalyticsRateLimit( string $session_id ): bool {
		$limit = max( 1, (int) apply_filters( 'allfeedback_analytics_rate_limit', 60 ) );
		$key   = 'allfeedback_al_' . substr( hash( 'sha256', $session_id ), 0, 16 );
		$count = (int) get_transient( $key );

		if ( $count >= $limit ) {
			return false;
		}

		set_transient( $key, $count + 1, 5 * MINUTE_IN_SECONDS );
		return true;
	}

	/**
	 * Rate-limit analytics events per visitor IP, so rotating session IDs cannot flood the table.
	 *
	 * @return bool True when under the limit; false when exceeded.
	 * @since  1.1.0
	 */
	private function checkIpRateLimit(): bool {
		/**
		 * Filters the maximum analytics events one IP may send per 5-minute window.
		 *
		 * @since 1.1.0
		 *
		 * @param int $limit Events allowed per window. Default 300.
		 */
		$limit    = max( 1, (int) apply_filters( 'allfeedback_analytics_ip_rate_limit', 300 ) );
		[ $hash ] = $this->resolveClientIp();
		$key      = 'allfeedback_ai_' . substr( $hash, 0, 16 );
		$count    = (int) get_transient( $key );

		if ( $count >= $limit ) {
			return false;
		}

		set_transient( $key, $count + 1, 5 * MINUTE_IN_SECONDS );
		return true;
	}

	/**
	 * Handle `GET /surveys/{id}/analytics`.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function getAnalytics( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$survey_id = (int) $request->get_param( 'id' );
		$metrics   = $this->session_repository->getAnalytics( $survey_id );

		return $this->successResponse( $metrics );
	}

	/**
	 * Build the argument schema for the event-tracking endpoint.
	 *
	 * @return array<string, array<string, mixed>>
	 * @since  1.0.0
	 */
	private function eventArgs(): array {
		return [
			'event'      => $this->argEnum(
				description: __( 'Analytics event type.', 'allfeedback' ),
				values:      [ 'viewed', 'started', 'abandoned', 'heartbeat' ],
				required:    true,
			),
			'session_id' => $this->argString(
				description: __( 'Client-generated session UUID (v4).', 'allfeedback' ),
				required:    true,
				max_length:   36,
			),
			'guest_id'   => $this->argString(
				description: __( 'Persistent guest visitor token from localStorage.', 'allfeedback' ),
				max_length:   36,
			),
		];
	}
}
