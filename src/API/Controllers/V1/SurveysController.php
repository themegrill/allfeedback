<?php
/**
 * REST controller for the /surveys resource.
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\API\Controllers\V1;

defined( 'ABSPATH' ) || exit;

use AllFeedback\API\RestController;
use AllFeedback\Core\Constants;
use AllFeedback\Domain\Response\ResponseRepository;
use AllFeedback\Domain\Survey\Survey;
use AllFeedback\Domain\Survey\SurveyFilter;
use AllFeedback\Domain\Survey\SurveyRepository;
use AllFeedback\Domain\Survey\SurveyStatus;
use AllFeedback\Support\Logger;

/**
 * Class SurveysController
 *
 * REST controller for the /surveys resource.
 *
 * Routes registered (all under allfeedback/v1):
 *   GET    /surveys                      → index()                : paginated list
 *   POST   /surveys                      → store()               : create
 *   DELETE /surveys/trash                → destroyMany()          : bulk trash
 *   DELETE /surveys/delete               → destroyManyPermanent() : bulk permanent delete
 *   GET    /surveys/{id}                 → show()                 : single survey
 *   PUT    /surveys/{id}                 → update()               : full or partial update / autosave
 *   DELETE /surveys/{id}/trash           → destroy()              : move to trash
 *   DELETE /surveys/{id}/delete          → destroyPermanent()     : permanent delete (must be trashed first)
 *   POST   /surveys/{id}/duplicate       → duplicate()            : copy survey
 *   POST   /surveys/{id}/publish         → publish()              : set status to published
 *   GET    /surveys/export               → export()               : export surveys as a JSON bundle
 *   POST   /surveys/import               → import()               : create surveys from a JSON bundle
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */
class SurveysController extends RestController {

	/**
	 * Valid field types the form builder may use inside form_schema.
	 *
	 * Names must match the `type` values emitted by the React builder exactly.
	 *
	 * @var string[]
	 * @since 1.0.0
	 */
	private const FIELD_TYPES = [
		'nps',
		'short_text',
		'long_text',
		'radio',
		'checkboxes',
		'dropdown',
		'star_rating',
		'scale',
		'email',
		'yes_no',
	];

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
	 * @param  SurveyRepository   $survey_repository   Survey aggregate repository.
	 * @param  ResponseRepository $response_repository Response aggregate repository.
	 * @param  Logger             $logger              Structured logger.
	 * @since  1.0.0
	 */
	public function __construct(
		private readonly SurveyRepository $survey_repository,
		private readonly ResponseRepository $response_repository,
		private readonly Logger $logger,
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
			'/' . $this->rest_base,
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'index' ],
					'permission_callback' => [ $this, 'adminPermission' ],
					'args'                => $this->collectionArgs(),
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'store' ],
					'permission_callback' => [ $this, 'adminPermission' ],
					'args'                => $this->writeArgs( required: true ),
				],
				'schema' => [ $this, 'getPublicItemSchema' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show' ],
					'permission_callback' => [ $this, 'publicPermission' ],
					'args'                => $this->idArg(),
				],
				[
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => [ $this, 'update' ],
					'permission_callback' => [ $this, 'adminPermission' ],
					'args'                => array_merge( $this->idArg(), $this->writeArgs( required: false ) ),
				],
				'schema' => [ $this, 'getPublicItemSchema' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/trash',
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'destroyMany' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => $this->bulkActionArgs(),
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/delete',
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'destroyManyPermanent' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => $this->bulkActionArgs(),
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/trash',
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'destroy' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => $this->idArg(),
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/delete',
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'destroyPermanent' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => $this->idArg(),
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/duplicate',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'duplicate' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => $this->idArg(),
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/export',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'export' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => [
					'ids' => [
						'description' => __( 'Comma-separated survey IDs to export.', 'allfeedback' ),
						'type'        => 'string',
						'required'    => true,
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/import',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'import' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => [
					'surveys' => [
						'description' => __( 'Surveys from an AllFeedback export file.', 'allfeedback' ),
						'type'        => 'array',
						'required'    => true,
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/publish',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'publish' ],
				'permission_callback' => [ $this, 'adminPermission' ],
				'args'                => $this->idArg(),
			]
		);
	}

	/**
	 * GET /allfeedback/v1/surveys
	 *
	 * Return a paginated list of surveys.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response
	 * @since  1.0.0
	 */
	public function index( \WP_REST_Request $request ): \WP_REST_Response {
		$page     = max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) );
		$per_page = min( 100, max( 1, (int) ( $request->get_param( 'per_page' ) ?? 20 ) ) );
		$search   = sanitize_text_field( (string) ( $request->get_param( 'search' ) ?? '' ) );
		$status   = (string) ( $request->get_param( 'status' ) ?? 'any' );
		$orderby  = sanitize_key( (string) ( $request->get_param( 'orderby' ) ?? 'created_at' ) );
		$order    = strtoupper( (string) ( $request->get_param( 'order' ) ?? 'DESC' ) );

		$filter = new SurveyFilter(
			status:  $status !== 'any' ? SurveyStatus::tryFrom( $status ) : null,
			page:    $page,
			per_page: $per_page,
			search:  $search !== '' ? $search : null,
			order_by: $orderby,
			order:   $order,
		);

		$surveys = $this->survey_repository->findAll( $filter );
		$total   = $this->survey_repository->count( $filter );

		return $this->successResponse(
			[
				'surveys'  => array_map( [ $this, 'prepareSurvey' ], $surveys ),
				'total'    => $total,
				'page'     => $page,
				'per_page' => $per_page,
			]
		);
	}

	/**
	 * POST /allfeedback/v1/surveys
	 *
	 * Create a new survey.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function store( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$form_schema = $request->get_param( 'form_schema' );

		if ( $form_schema !== null ) {
			$schema_check = $this->validateFormSchema( $form_schema );
			if ( is_wp_error( $schema_check ) ) {
				return $schema_check;
			}
		}

		$settings = $request->get_param( 'settings' );
		if ( $settings !== null ) {
			$settings_check = $this->validateSettings( $settings );
			if ( is_wp_error( $settings_check ) ) {
				return $settings_check;
			}
			$settings = apply_filters( 'allfeedback_settings_before_save', $settings, $request );
		}

		$form_schema_array = $form_schema !== null ? ( $this->normaliseJsonParam( $form_schema ) ?? [] ) : [];
		$settings_array    = $settings !== null ? ( $this->normaliseJsonParam( $settings ) ?? [] ) : [];

		$survey = new Survey(
			title:       sanitize_text_field( (string) $request->get_param( 'title' ) ),
			description: wp_kses_post( (string) ( $request->get_param( 'description' ) ?? '' ) ),
			form_schema:  $form_schema_array,
			settings:    $settings_array,
			created_by:   get_current_user_id(),
		);

		try {
			$survey = $this->survey_repository->save( $survey );
		} catch ( \RuntimeException $e ) {
			$this->logger->error(
				'Survey creation failed at DB layer.',
				[
					'user_id' => get_current_user_id(),
					'error' => $e->getMessage(),
				]
			);
			return $this->errorResponse( __( 'Failed to create survey.', 'allfeedback' ), 500 );
		}

		$schema_stats = $this->schemaStats( $form_schema_array );

		$this->logger->info(
			'Survey created.',
			array_merge(
				[
					'survey_id'  => $survey->getId(),
					'title'      => $survey->getTitle(),
					'has_schema' => $form_schema_array !== [],
					'user_id'    => get_current_user_id(),
				],
				$schema_stats
			)
		);

		return $this->successResponse( $this->prepareSurvey( $survey ), 201 );
	}

	/**
	 * GET /allfeedback/v1/surveys/{id}
	 *
	 * Return a single survey including full form_schema, settings, and targeting.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function show( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$survey = $this->survey_repository->findById( (int) $request->get_param( 'id' ) );

		if ( $survey === null ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		if ( ! current_user_can( 'manage_options' ) && ! $survey->isLive() ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		return $this->successResponse( $this->prepareSurvey( $survey ) );
	}

	/**
	 * PUT /allfeedback/v1/surveys/{id}
	 *
	 * Apply a full or partial update to an existing survey.
	 * Called by the builder autosave on every change.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function update( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$id   = (int) $request->get_param( 'id' );
		$body = $request->get_json_params() ?? [];

		$survey = $this->survey_repository->findById( $id );
		if ( $survey === null ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		$previous_status = $survey->getStatus();
		$changed         = false;

		if ( array_key_exists( 'title', $body ) ) {
			$survey->setTitle( sanitize_text_field( (string) $request->get_param( 'title' ) ) );
			$changed = true;
		}

		if ( array_key_exists( 'description', $body ) ) {
			$survey->setDescription( wp_kses_post( (string) $request->get_param( 'description' ) ) );
			$changed = true;
		}

		if ( array_key_exists( 'form_schema', $body ) ) {
			$form_schema  = $request->get_param( 'form_schema' );
			$schema_check = $this->validateFormSchema( $form_schema );
			if ( is_wp_error( $schema_check ) ) {
				return $schema_check;
			}
			$survey->setFormSchema( $this->normaliseJsonParam( $form_schema ) ?? [] );
			$changed = true;
		}

		if ( array_key_exists( 'settings', $body ) ) {
			$settings_raw   = $request->get_param( 'settings' );
			$settings_check = $this->validateSettings( $settings_raw );
			if ( is_wp_error( $settings_check ) ) {
				return $settings_check;
			}
			/** This filter is documented in store(). */ // phpcs:ignore Generic.Commenting.DocComment.MissingShort -- inline type hint
			$settings_raw = apply_filters( 'allfeedback_settings_before_save', $settings_raw, $request );
			$survey->setSettings( $this->normaliseJsonParam( $settings_raw ) ?? [] );
			$changed = true;
		}

		if ( array_key_exists( 'styling', $body ) ) {
			$styling_raw   = $request->get_param( 'styling' );
			$styling_check = $this->validateStyling( $styling_raw );
			if ( is_wp_error( $styling_check ) ) {
				return $styling_check;
			}
			$survey->setStyling( $this->normaliseJsonParam( $styling_raw ) ?? [] );
			$changed = true;
		}

		$transitioning_to_published = false;
		$transitioning_to_draft     = false;

		if ( array_key_exists( 'status', $body ) ) {
			$status_str = sanitize_key( (string) $request->get_param( 'status' ) );
			$status     = SurveyStatus::tryFrom( $status_str );
			if ( $status === null ) {
				return $this->errorResponse(
					sprintf(
						/* translators: %s: Comma-separated list of valid statuses */
						__( 'Invalid status. Allowed values: %s.', 'allfeedback' ),
						implode( ', ', array_column( SurveyStatus::cases(), 'value' ) )
					),
					422
				);
			}
			$transitioning_to_published = ( $status === SurveyStatus::Published );
			$transitioning_to_draft     = ( $status === SurveyStatus::Draft && $survey->getStatus() === SurveyStatus::Published );
			match ( $status ) {
				SurveyStatus::Published => $survey->publish(),
				SurveyStatus::Archived  => $survey->archive(),
				SurveyStatus::Trashed   => $survey->trash(),
				SurveyStatus::Draft     => $survey->restore(),
			};
			$changed = true;
		}

		if ( ! $changed ) {
			return $this->successResponse( $this->prepareSurvey( $survey ) );
		}

		if ( $transitioning_to_published || $transitioning_to_draft ) {
			$conflicts = $this->detectPublishingConflicts( $survey );
			if ( ! empty( $conflicts ) ) {
				if ( $transitioning_to_published ) {
					$survey->restore();
				}
				$conflict_titles = implode(
					', ',
					array_map(
						static fn( array $c ) => '"' . $c['title'] . '"',
						$conflicts
					)
				);
				$survey->setConflictReason(
					sprintf(
						/* translators: %s: comma-separated conflicting form titles */
						__( 'Saved as draft — same pages already targeted by %s.', 'allfeedback' ),
						$conflict_titles
					)
				);
			} else {
				$survey->setConflictReason( null );
			}
		}

		try {
			$survey = $this->survey_repository->save( $survey );
		} catch ( \RuntimeException $e ) {
			$this->logger->error(
				'Survey update failed at DB layer.',
				[
					'survey_id' => $id,
					'user_id' => get_current_user_id(),
					'error' => $e->getMessage(),
				]
			);
			return $this->errorResponse( __( 'Failed to update survey.', 'allfeedback' ), 500 );
		}

		$log_context = [
			'survey_id'    => $id,
			'changed_keys' => array_keys( $body ),
			'user_id'      => get_current_user_id(),
		];

		if ( array_key_exists( 'form_schema', $body ) ) {
			$log_context = array_merge( $log_context, $this->schemaStats( $survey->getFormSchema() ) );
		}

		$this->logger->info( 'Survey updated.', $log_context );

		do_action( 'allfeedback_survey_updated', $survey );

		if ( $transitioning_to_published && $survey->getStatus()->isPublished() ) {
			$this->draftInactiveOverlaps( $survey );
		}

		if ( $transitioning_to_published && $survey->getStatus()->isPublished() && ! $previous_status->isPublished() ) {
			do_action( 'allfeedback_survey_activated', $survey );
		}

		return $this->successResponse( $this->prepareSurvey( $survey ) );
	}

	/**
	 * DELETE /allfeedback/v1/surveys/{id}/trash
	 *
	 * Move a survey to the trash (sets status to 'trashed').
	 * To permanently remove a trashed survey use DELETE /surveys/{id}/delete.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function destroy( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$survey = $this->survey_repository->findById( $id );

		if ( $survey === null ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		if ( $survey->getStatus()->isTrashed() ) {
			return $this->errorResponse(
				__( 'Survey is already in the trash. Use DELETE /surveys/{id}/delete to remove it permanently.', 'allfeedback' ),
				409
			);
		}

		$survey->trash();

		try {
			$this->survey_repository->save( $survey );
		} catch ( \RuntimeException $e ) {
			$this->logger->error(
				'Survey trash failed at DB layer.',
				[
					'survey_id' => $id,
					'user_id' => get_current_user_id(),
					'error' => $e->getMessage(),
				]
			);
			return $this->errorResponse( __( 'Failed to move survey to trash.', 'allfeedback' ), 500 );
		}

		$this->logger->info(
			'Survey moved to trash.',
			[
				'survey_id' => $id,
				'title' => $survey->getTitle(),
				'user_id' => get_current_user_id(),
			]
		);

		return $this->successResponse(
			[
				'trashed' => true,
				'id' => $id,
			]
		);
	}

	/**
	 * DELETE /allfeedback/v1/surveys/{id}/delete
	 *
	 * Permanently remove a trashed survey from the database.
	 * The survey must have status 'trashed' — use DELETE /surveys/{id}/trash first.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function destroyPermanent( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$survey = $this->survey_repository->findById( $id );

		if ( $survey === null ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		if ( ! $survey->getStatus()->isTrashed() ) {
			return $this->errorResponse(
				__( 'Only trashed surveys can be permanently deleted. Use DELETE /surveys/{id}/trash first.', 'allfeedback' ),
				409
			);
		}

		if ( ! $this->survey_repository->delete( $id ) ) {
			$this->logger->error(
				'Permanent survey deletion failed at DB layer.',
				[
					'survey_id' => $id,
					'user_id' => get_current_user_id(),
				]
			);
			return $this->errorResponse( __( 'Failed to permanently delete survey.', 'allfeedback' ), 500 );
		}

		$this->response_repository->deleteBySurveyId( $id );

		$this->logger->info(
			'Survey permanently deleted.',
			[
				'survey_id' => $id,
				'title' => $survey->getTitle(),
				'user_id' => get_current_user_id(),
			]
		);

		return $this->successResponse(
			[
				'deleted' => true,
				'id' => $id,
			]
		);
	}

	/**
	 * GET /allfeedback/v1/surveys/export
	 *
	 * Return the chosen surveys as a portable JSON bundle.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.1.0
	 */
	public function export( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$ids = array_values( array_unique( array_filter( array_map( 'absint', explode( ',', (string) $request->get_param( 'ids' ) ) ) ) ) );

		if ( $ids === [] ) {
			return $this->errorResponse( __( 'Select at least one survey to export.', 'allfeedback' ), 422 );
		}

		$surveys = [];
		foreach ( $ids as $id ) {
			$survey = $this->survey_repository->findById( $id );
			if ( $survey === null ) {
				continue;
			}
			$surveys[] = [
				'title'       => $survey->getTitle(),
				'description' => $survey->getDescription(),
				'form_schema' => $survey->getFormSchema(),
				'settings'    => $survey->getSettings(),
				'styling'     => $survey->getStyling(),
			];
		}

		if ( $surveys === [] ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		$this->logger->info(
			'Surveys exported.',
			[
				'count'   => count( $surveys ),
				'user_id' => get_current_user_id(),
			]
		);

		return $this->successResponse(
			[
				'plugin'      => 'allfeedback',
				'version'     => Constants::VERSION,
				'exported_at' => gmdate( 'c' ),
				'surveys'     => $surveys,
			]
		);
	}

	/**
	 * POST /allfeedback/v1/surveys/import
	 *
	 * Create a draft survey for each entry of an export bundle.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.1.0
	 */
	public function import( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$items = $request->get_param( 'surveys' );

		if ( ! is_array( $items ) || $items === [] ) {
			return $this->errorResponse( __( 'The file has no surveys to import.', 'allfeedback' ), 422 );
		}

		$imported = [];
		$failed   = [];

		foreach ( array_values( $items ) as $index => $item ) {
			$item  = $this->normaliseJsonParam( $item ) ?? [];
			$title = sanitize_text_field( (string) ( $item['title'] ?? '' ) );

			if ( $title === '' ) {
				$failed[] = [
					'index'  => $index,
					'title'  => '',
					'reason' => __( 'Missing title.', 'allfeedback' ),
				];
				continue;
			}

			foreach ( [ $this->validateFormSchema( $item['form_schema'] ?? null ), $this->validateSettings( $item['settings'] ?? null ), $this->validateStyling( $item['styling'] ?? null ) ] as $check ) {
				if ( is_wp_error( $check ) ) {
					$failed[] = [
						'index'  => $index,
						'title'  => $title,
						'reason' => $check->get_error_message(),
					];
					continue 2;
				}
			}

			$survey = new Survey(
				title:       $title,
				description: wp_kses_post( (string) ( $item['description'] ?? '' ) ),
				form_schema: $this->normaliseJsonParam( $item['form_schema'] ?? null ) ?? [],
				settings:    $this->normaliseJsonParam( $item['settings'] ?? null ) ?? [],
				styling:     $this->normaliseJsonParam( $item['styling'] ?? null ) ?? [],
				created_by:  get_current_user_id(),
			);

			try {
				$imported[] = $this->prepareSurvey( $this->survey_repository->save( $survey ) );
			} catch ( \RuntimeException $e ) {
				$this->logger->error(
					'Survey import failed at DB layer.',
					[
						'title' => $title,
						'error' => $e->getMessage(),
					]
				);
				$failed[] = [
					'index'  => $index,
					'title'  => $title,
					'reason' => __( 'Failed to save survey.', 'allfeedback' ),
				];
			}
		}

		$this->logger->info(
			'Surveys imported.',
			[
				'imported' => count( $imported ),
				'failed'   => count( $failed ),
				'user_id'  => get_current_user_id(),
			]
		);

		return $this->successResponse(
			[
				'imported' => count( $imported ),
				'surveys'  => $imported,
				'failed'   => $failed,
			],
			$imported !== [] ? 201 : 200
		);
	}

	/**
	 * POST /allfeedback/v1/surveys/{id}/duplicate
	 *
	 * Create a copy of a survey with status reset to draft.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function duplicate( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$id       = (int) $request->get_param( 'id' );
		$original = $this->survey_repository->findById( $id );

		if ( $original === null ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		$copy = new Survey(
			title:       $original->getTitle() . ' ' . __( '(Copy)', 'allfeedback' ),
			description: $original->getDescription(),
			form_schema:  $original->getFormSchema(),
			settings:    $original->getSettings(),
			created_by:   get_current_user_id(),
		);

		try {
			$copy = $this->survey_repository->save( $copy );
		} catch ( \RuntimeException $e ) {
			$this->logger->error(
				'Survey duplication failed at DB layer.',
				[
					'source_id' => $id,
					'user_id' => get_current_user_id(),
					'error' => $e->getMessage(),
				]
			);
			return $this->errorResponse( __( 'Failed to duplicate survey.', 'allfeedback' ), 500 );
		}

		return $this->successResponse( $this->prepareSurvey( $copy ), 201 );
	}

	/**
	 * POST /allfeedback/v1/surveys/{id}/publish
	 *
	 * Transition a survey to published status.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function publish( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		return $this->transitionStatus( (int) $request->get_param( 'id' ), SurveyStatus::Published );
	}

	/**
	 * DELETE /allfeedback/v1/surveys/trash
	 *
	 * Bulk-trash multiple surveys by ID.
	 * Surveys that are already trashed are skipped (not counted as failures).
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function destroyMany( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$ids = array_values( array_filter( array_map( 'absint', (array) ( $request->get_param( 'ids' ) ?? [] ) ) ) );

		if ( empty( $ids ) ) {
			return $this->errorResponse( __( 'No survey IDs provided.', 'allfeedback' ), 422 );
		}

		$trashed = 0;
		$skipped = [];
		$failed  = [];

		foreach ( $ids as $id ) {
			$survey = $this->survey_repository->findById( $id );

			if ( $survey === null ) {
				$failed[] = $id;
				continue;
			}

			if ( $survey->getStatus()->isTrashed() ) {
				$skipped[] = $id;
				continue;
			}

			$survey->trash();

			try {
				$this->survey_repository->save( $survey );
				++$trashed;
			} catch ( \RuntimeException ) {
				$failed[] = $id;
			}
		}

		$this->logger->info(
			'Bulk survey trash completed.',
			[
				'requested'     => $ids,
				'trashed_count' => $trashed,
				'skipped'       => $skipped,
				'failed'        => $failed,
				'user_id'       => get_current_user_id(),
			]
		);

		return $this->successResponse(
			[
				'trashed' => $trashed,
				'skipped' => $skipped,
				'failed'  => $failed,
			]
		);
	}

	/**
	 * DELETE /allfeedback/v1/surveys/delete
	 *
	 * Bulk permanently delete multiple surveys by ID.
	 * Only surveys with status 'trashed' are deleted — others are skipped.
	 * Use DELETE /surveys/trash first to move surveys to the trash.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function destroyManyPermanent( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$ids = array_values( array_filter( array_map( 'absint', (array) ( $request->get_param( 'ids' ) ?? [] ) ) ) );

		if ( empty( $ids ) ) {
			return $this->errorResponse( __( 'No survey IDs provided.', 'allfeedback' ), 422 );
		}

		$deleted = 0;
		$skipped = [];
		$failed  = [];

		foreach ( $ids as $id ) {
			$survey = $this->survey_repository->findById( $id );

			if ( $survey === null ) {
				$failed[] = $id;
				continue;
			}

			if ( ! $survey->getStatus()->isTrashed() ) {
				$skipped[] = $id;
				continue;
			}

			if ( $this->survey_repository->delete( $id ) ) {
				++$deleted;
				$this->response_repository->deleteBySurveyId( $id );
			} else {
				$failed[] = $id;
			}
		}

		$this->logger->info(
			'Bulk survey permanent deletion completed.',
			[
				'requested'     => $ids,
				'deleted_count' => $deleted,
				'skipped'       => $skipped,
				'failed'        => $failed,
				'user_id'       => get_current_user_id(),
			]
		);

		return $this->successResponse(
			[
				'deleted' => $deleted,
				'skipped' => $skipped,
				'failed'  => $failed,
			]
		);
	}

	/**
	 * JSON schema for a single survey item.
	 *
	 * @return array<string, mixed>
	 * @since  1.0.0
	 */
	public function getPublicItemSchema(): array {
		$status_values = array_column( SurveyStatus::cases(), 'value' );

		return [
			'$schema'    => 'http://json-schema.org/draft-04/schema#',
			'title'      => 'allfeedback_survey',
			'type'       => 'object',
			'properties' => [
				'id'             => [
					'description' => __( 'Unique identifier.', 'allfeedback' ),
					'type'        => 'integer',
					'context'     => [ 'view', 'edit' ],
					'readonly'    => true,
				],
				'title'          => [
					'description' => __( 'Survey title shown in the forms list.', 'allfeedback' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit' ],
				],
				'description'    => [
					'description' => __( 'Optional survey description (HTML allowed).', 'allfeedback' ),
					'type'        => [ 'string', 'null' ],
					'context'     => [ 'view', 'edit' ],
				],
				'form_schema'    => [
					'description' => __( 'Full builder structure: sections, fields, conditional logic.', 'allfeedback' ),
					'type'        => [ 'object', 'null' ],
					'context'     => [ 'view', 'edit' ],
				],
				'settings'       => [
					'description' => __( 'Per-survey configuration: submit labels, user targeting, trigger, display frequency.', 'allfeedback' ),
					'type'        => [ 'object', 'null' ],
					'context'     => [ 'view', 'edit' ],
				],
				'status'         => [
					'description' => __( 'Survey lifecycle status.', 'allfeedback' ),
					'type'        => 'string',
					'enum'        => $status_values,
					'context'     => [ 'view', 'edit' ],
				],
				'response_count' => [
					'description' => __( 'Cached count of responses received.', 'allfeedback' ),
					'type'        => 'integer',
					'minimum'     => 0,
					'context'     => [ 'view' ],
					'readonly'    => true,
				],
				'created_by'     => [
					'description' => __( 'WordPress user ID of the creator.', 'allfeedback' ),
					'type'        => [ 'integer', 'null' ],
					'context'     => [ 'view' ],
					'readonly'    => true,
				],
				'created_at'     => [
					'description' => __( 'Creation date (MySQL datetime).', 'allfeedback' ),
					'type'        => 'string',
					'context'     => [ 'view' ],
					'readonly'    => true,
				],
				'updated_at'     => [
					'description' => __( 'Last update date (MySQL datetime).', 'allfeedback' ),
					'type'        => [ 'string', 'null' ],
					'context'     => [ 'view' ],
					'readonly'    => true,
				],
			],
		];
	}

	/**
	 * Query-string arguments for GET /surveys.
	 *
	 * @return array<string, array<string, mixed>>
	 * @since  1.0.0
	 */
	private function collectionArgs(): array {
		$status_values = array_column( SurveyStatus::cases(), 'value' );

		return array_merge(
			$this->paginationArgs( default_per_page: 20, max_per_page: 100 ),
			[
				'search'  => $this->argString(
					description: __( 'Filter surveys by title keyword.', 'allfeedback' ),
				),
				'status'  => $this->argEnum(
					description: __( 'Filter by survey status.', 'allfeedback' ),
					values:      array_merge( $status_values, [ 'any' ] ),
					default:     'any',
				),
				'orderby' => $this->argEnum(
					description: __( 'Column to sort results by.', 'allfeedback' ),
					values:      [ 'id', 'title', 'status', 'response_count', 'created_at', 'updated_at' ],
					default:     'created_at',
				),
				'order'   => $this->argEnum(
					description: __( 'Sort direction.', 'allfeedback' ),
					values:      [ 'ASC', 'DESC' ],
					default:     'DESC',
				),
			]
		);
	}

	/**
	 * Body arguments for POST (create) and PUT (update).
	 *
	 * @param  bool $required Whether title is required (true for create, false for update).
	 * @return array<string, array<string, mixed>>
	 * @since  1.0.0
	 */
	private function writeArgs( bool $required ): array {
		$status_values = array_column( SurveyStatus::cases(), 'value' );

		return [
			'title'       => $this->argString(
				description: __( 'Survey title.', 'allfeedback' ),
				required:    $required,
				min_length:   1,
				max_length:   255,
			),
			'description' => $this->argString(
				description: __( 'Optional survey description (HTML allowed).', 'allfeedback' ),
				sanitize:    'wp_kses_post',
				default:     '',
			),
			'form_schema' => [
				'description' => __( 'Builder structure: version string, sections array with fields.', 'allfeedback' ),
				'type'        => [ 'object', 'array', 'string', 'null' ],
			],
			'settings'    => [
				'description' => __( 'Per-survey configuration object (trigger, frequency, targeting, submit labels).', 'allfeedback' ),
				'type'        => [ 'object', 'array', 'string', 'null' ],
			],
			'styling'     => [
				'description' => __( 'Per-survey visual appearance overrides (widget icon, label, position).', 'allfeedback' ),
				'type'        => [ 'object', 'array', 'string', 'null' ],
			],
			'status'      => $this->argEnum(
				description: __( 'Survey lifecycle status.', 'allfeedback' ),
				values:      $status_values,
				default:     'draft',
			),
		];
	}

	/**
	 * Body arguments shared by bulk trash and bulk permanent delete endpoints.
	 *
	 * @return array<string, array<string, mixed>>
	 * @since  1.0.0
	 */
	private function bulkActionArgs(): array {
		return [
			'ids' => [
				'description' => __( 'Array of survey IDs to operate on.', 'allfeedback' ),
				'type'        => 'array',
				'required'    => true,
				'items'       => [
					'type'    => 'integer',
					'minimum' => 1,
				],
				'minItems'    => 1,
			],
		];
	}

	/**
	 * Serialise a Survey aggregate into the REST response shape.
	 *
	 * @param  Survey $survey Survey aggregate root.
	 * @return array<string, mixed>
	 * @since  1.0.0
	 */
	private function prepareSurvey( Survey $survey ): array {
		$form_schema = $survey->getFormSchema();
		$settings    = $survey->getSettings();

		$styling = $survey->getStyling();

		$prepared = [
			'id'              => $survey->getId(),
			'title'           => $survey->getTitle(),
			'description'     => $survey->getDescription(),
			'form_schema'     => $form_schema !== [] ? $form_schema : null,
			'settings'        => $settings !== [] ? $settings : null,
			'styling'         => $styling !== [] ? $styling : null,
			'status'          => $survey->getStatus()->value,
			'conflict_reason'  => $survey->getConflictReason(),
			'missing_features' => $survey->getMissingFeatures(),
			'response_count'   => $survey->getResponseCount(),
			'created_by'      => $survey->getCreatedBy() !== 0 ? $survey->getCreatedBy() : null,
			'created_at'      => $survey->getCreatedAt()->format( 'Y-m-d H:i:s' ),
			'updated_at'      => $survey->getUpdatedAt()?->format( 'Y-m-d H:i:s' ),
		];

		return apply_filters( 'allfeedback_prepare_survey', $prepared, $survey );
	}

	/**
	 * Retrieve a survey, change its status, persist, and return the updated representation.
	 *
	 * @param  int          $id     Survey primary key.
	 * @param  SurveyStatus $status Target status.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	private function transitionStatus( int $id, SurveyStatus $status ): \WP_REST_Response|\WP_Error {
		$survey = $this->survey_repository->findById( $id );

		if ( $survey === null ) {
			return $this->notFoundResponse( __( 'Survey', 'allfeedback' ) );
		}

		$previous_status = $survey->getStatus();

		match ( $status ) {
			SurveyStatus::Published => $survey->publish(),
			SurveyStatus::Archived  => $survey->archive(),
			SurveyStatus::Trashed   => $survey->trash(),
			SurveyStatus::Draft     => $survey->restore(),
		};

		if ( $status === SurveyStatus::Published ) {
			$conflicts = $this->detectPublishingConflicts( $survey );
			if ( ! empty( $conflicts ) ) {
				$survey->restore();
				$conflict_titles = implode(
					', ',
					array_map(
						static fn( array $c ) => '"' . $c['title'] . '"',
						$conflicts
					)
				);
				$survey->setConflictReason(
					sprintf(
						/* translators: %s: comma-separated conflicting form titles */
						\__( 'Saved as draft — same pages already targeted by %s.', 'allfeedback' ),
						$conflict_titles
					)
				);
			} else {
				$survey->setConflictReason( null );
			}
		}

		try {
			$survey = $this->survey_repository->save( $survey );
		} catch ( \RuntimeException $e ) {
			$this->logger->error(
				'Survey status transition failed at DB layer.',
				[
					'survey_id' => $id,
					'target_status' => $status->value,
					'user_id' => get_current_user_id(),
					'error' => $e->getMessage(),
				]
			);
			return $this->errorResponse(
				sprintf(
					/* translators: %s: Target status */
					__( 'Failed to set survey status to %s.', 'allfeedback' ),
					$status->value
				),
				500
			);
		}

		$form_schema   = $survey->getFormSchema();
		$has_schema    = $form_schema !== [];
		$actual_status = $survey->getStatus();

		if ( $status === SurveyStatus::Published && ! $has_schema && $survey->getConflictReason() === null ) {
			$this->logger->warning(
				'Survey published without a form schema.',
				[
					'survey_id' => $id,
					'title' => $survey->getTitle(),
					'user_id' => get_current_user_id(),
				]
			);
		}

		$this->logger->info(
			"Survey status changed to {$actual_status->value}.",
			array_merge(
				[
					'survey_id'       => $id,
					'title'           => $survey->getTitle(),
					'previous_status' => $previous_status->value,
					'new_status'      => $actual_status->value,
					'has_schema'      => $has_schema,
					'user_id'         => get_current_user_id(),
				],
				$this->schemaStats( $form_schema )
			)
		);

		do_action( 'allfeedback_survey_updated', $survey );

		if ( $status === SurveyStatus::Published && $survey->getStatus()->isPublished() ) {
			$this->draftInactiveOverlaps( $survey );
		}

		if ( $survey->getStatus()->isPublished() && ! $previous_status->isPublished() ) {
			do_action( 'allfeedback_survey_activated', $survey );
		}

		return $this->successResponse( $this->prepareSurvey( $survey ) );
	}

	/**
	 * Detect live surveys whose targeting overlaps with $published.
	 *
	 * Inactive surveys (published but missing add-on features) are not shown
	 * to visitors, so they never block publishing.
	 *
	 * Returns an array of conflict descriptors (id, title, targeting_scope).
	 *
	 * @param  Survey $published The survey being published.
	 * @return array<int, array<string, mixed>>
	 * @since  1.0.0
	 */
	private function detectPublishingConflicts( Survey $published ): array {
		$conflicts = [];

		foreach ( $this->findOverlappingPublished( $published ) as $other ) {
			if ( ! $other->isLive() ) {
				continue;
			}

			$conflicts[] = [
				'id'              => $other->getId(),
				'title'           => $other->getTitle(),
				'targeting_scope' => $this->targetingScope( $other ),
			];
		}

		return $conflicts;
	}

	/**
	 * Move inactive surveys that overlap a newly published survey back to draft.
	 *
	 * Keeps the newly published survey live when the add-on comes back, instead
	 * of two surveys competing for the same pages.
	 *
	 * @param  Survey $published The survey that was just published.
	 * @return void
	 * @since  1.1.0
	 */
	private function draftInactiveOverlaps( Survey $published ): void {
		foreach ( $this->findOverlappingPublished( $published ) as $other ) {
			if ( $other->isLive() ) {
				continue;
			}

			$other->restore();
			$other->setConflictReason(
				sprintf(
					/* translators: %s: title of the survey that now targets the same pages */
					__( 'Saved as draft — same pages now targeted by "%s".', 'allfeedback' ),
					$published->getTitle()
				)
			);

			try {
				$this->survey_repository->save( $other );
			} catch ( \RuntimeException $e ) {
				$this->logger->error(
					'Failed to move inactive overlapping survey to draft.',
					[
						'survey_id'    => $other->getId(),
						'published_id' => $published->getId(),
						'error'        => $e->getMessage(),
					]
				);
				continue;
			}

			$this->logger->info(
				'Inactive overlapping survey moved to draft.',
				[
					'survey_id'    => $other->getId(),
					'published_id' => $published->getId(),
				]
			);

			do_action( 'allfeedback_survey_updated', $other );
		}
	}

	/**
	 * Find other published surveys whose targeting overlaps with $survey.
	 *
	 * @param  Survey $survey The survey to compare against.
	 * @return Survey[]
	 * @since  1.1.0
	 */
	private function findOverlappingPublished( Survey $survey ): array {
		try {
			$others = $this->survey_repository->findAll(
				new SurveyFilter( status: SurveyStatus::Published, per_page: 200 )
			);
		} catch ( \Throwable ) {
			return [];
		}

		$survey_id       = $survey->getId();
		$survey_scope    = $this->targetingScope( $survey );
		$survey_page_ids = $this->targetingPageIds( $survey );
		$overlapping     = [];

		// Embed-only surveys never auto-show, so they can't compete for a page.
		if ( $survey_scope === 'embed_only' ) {
			return [];
		}

		foreach ( $others as $other ) {
			$other_scope = $this->targetingScope( $other );

			if ( $other->getId() === $survey_id || $other_scope === 'embed_only' ) {
				continue;
			}

			if (
				$survey_scope === 'all_pages'
				|| $other_scope === 'all_pages'
				|| ! empty( array_intersect( $survey_page_ids, $this->targetingPageIds( $other ) ) )
			) {
				$overlapping[] = $other;
			}
		}

		return $overlapping;
	}

	/**
	 * Return a human-readable targeting scope string for a survey.
	 *
	 * @param  Survey $survey Survey aggregate to inspect.
	 * @return string One of 'all_pages', 'specific_pages' or 'embed_only'.
	 * @since  1.0.0
	 */
	private function targetingScope( Survey $survey ): string {
		$settings  = $survey->getSettings();
		$targeting = (array) ( $settings['targeting'] ?? [] );

		if ( ! empty( $targeting ) ) {
			$mode = (string) ( $targeting['mode'] ?? 'all' );
			return $mode === 'all' ? 'all_pages' : 'specific_pages';
		}

		$target_pages = (string) ( $settings['targetPages'] ?? $settings['target_pages'] ?? 'all' );
		if ( $target_pages === 'none' ) {
			return 'embed_only';
		}
		return $target_pages === 'all' ? 'all_pages' : 'specific_pages';
	}

	/**
	 * Return the page/post IDs a survey explicitly targets (empty = all pages).
	 *
	 * @param  Survey $survey Survey aggregate to inspect.
	 * @return int[]
	 * @since  1.0.0
	 */
	private function targetingPageIds( Survey $survey ): array {
		$settings  = $survey->getSettings();
		$targeting = (array) ( $settings['targeting'] ?? [] );

		if ( ! empty( $targeting ) ) {
			if ( ( $targeting['mode'] ?? 'all' ) === 'all' ) {
				return [];
			}
			$ids = [];
			foreach ( (array) ( $targeting['rules'] ?? [] ) as $rule ) {
				if ( isset( $rule['value'] ) && in_array( $rule['type'] ?? '', [ 'page_id', 'post_id' ], true ) ) {
					$ids[] = (int) $rule['value'];
				}
			}
			return $ids;
		}

		$target_pages = (string) ( $settings['targetPages'] ?? $settings['target_pages'] ?? 'all' );
		if ( $target_pages === 'all' ) {
			return [];
		}

		return array_values(
			array_filter(
				array_map( 'intval', (array) ( $settings['target_page_ids'] ?? [] ) ),
				fn( int $id ) => $id > 0
			)
		);
	}

	/**
	 * Validate that form_schema contains valid JSON with allowed field types.
	 *
	 * Accepts arrays (WP JSON body parsing), stdClass objects, or pre-encoded
	 * JSON strings — all three are normalised to an array before validation.
	 *
	 * @param  mixed $schema Raw value from the request.
	 * @return true|\WP_Error
	 * @since  1.0.0
	 */
	private function validateFormSchema( mixed $schema ): true|\WP_Error {
		if ( $schema === null || $schema === '' ) {
			return true;
		}

		$schema = $this->normaliseJsonParam( $schema );

		if ( $schema === null ) {
			return $this->errorResponse( __( 'form_schema must be a valid JSON object.', 'allfeedback' ), 422 );
		}

		if ( ! isset( $schema['sections'] ) || ! is_array( $schema['sections'] ) ) {
			return true;
		}

		foreach ( $schema['sections'] as $section ) {
			$section = (array) $section;

			if ( empty( $section['fields'] ) || ! is_array( $section['fields'] ) ) {
				continue;
			}

			foreach ( $section['fields'] as $field ) {
				$field = (array) $field;

				if ( isset( $field['type'] ) && ! in_array( $field['type'], self::FIELD_TYPES, true ) ) {
					return $this->errorResponse(
						sprintf(
							/* translators: %s: Invalid field type value */
							__( 'Invalid field type "%s".', 'allfeedback' ),
							sanitize_key( (string) $field['type'] )
						),
						422
					);
				}
			}
		}

		return true;
	}

	/**
	 * Validate the settings object against the canonical settings contract.
	 *
	 * All keys are optional — only present keys are validated.
	 * Unknown keys pass through unmodified (forward-compatibility for pro add-ons).
	 * Each enum list is filterable so pro features can register new valid values.
	 *
	 * @param  mixed $settings Raw settings value from the request.
	 * @return true|\WP_Error
	 * @since  1.0.0
	 */
	private function validateSettings( mixed $settings ): true|\WP_Error {
		if ( $settings === null || $settings === '' ) {
			return true;
		}

		$settings = $this->normaliseJsonParam( $settings );

		if ( $settings === null ) {
			return $this->errorResponse( __( 'settings must be a valid JSON object.', 'allfeedback' ), 422 );
		}

		/**
		 * Each entry: settings key => filterable list of allowed string values.
		 * Pro add-ons filter the individual lists to register new allowed values
		 * (e.g. add "exit_intent" to trigger types without touching core code).
		 *
		 * @var array<string, string[]>
		 */
		$enum_rules = [
			'trigger_type'      => apply_filters(
				'allfeedback_settings_allowed_trigger_types',
				[ 'immediate', 'time_delay', 'scroll_depth' ]
			),
			'delay_unit'        => apply_filters(
				'allfeedback_settings_allowed_delay_units',
				[ 'seconds', 'minutes', 'hours' ]
			),
			'display_frequency' => apply_filters(
				'allfeedback_settings_allowed_display_frequencies',
				[ 'once', 'until_submit' ]
			),
			'dismiss_wait_unit' => apply_filters(
				'allfeedback_settings_allowed_dismiss_units',
				[ 'hours', 'days', 'weeks' ]
			),
			'user_state'        => apply_filters(
				'allfeedback_settings_allowed_user_states',
				[ 'all', 'logged_in', 'logged_out' ]
			),
			'target_pages'      => apply_filters(
				'allfeedback_settings_allowed_target_pages',
				[ 'all', 'specific' ]
			),
		];

		foreach ( $enum_rules as $key => $allowed ) {
			if ( ! array_key_exists( $key, $settings ) ) {
				continue;
			}
			if ( ! in_array( $settings[ $key ], $allowed, true ) ) {
				return $this->errorResponse(
					sprintf(
						/* translators: 1: settings key name  2: submitted value  3: comma-separated allowed values */
						__( 'Invalid settings.%1$s "%2$s". Allowed: %3$s.', 'allfeedback' ),
						$key,
						sanitize_key( (string) $settings[ $key ] ),
						implode( ', ', $allowed )
					),
					422
				);
			}
		}

		foreach ( [ 'delay_value', 'scroll_depth', 'max_impressions', 'dismiss_wait_value' ] as $key ) {
			if ( ! array_key_exists( $key, $settings ) ) {
				continue;
			}
			if ( filter_var( $settings[ $key ], FILTER_VALIDATE_INT ) === false || (int) $settings[ $key ] < 0 ) {
				return $this->errorResponse(
					sprintf(
						/* translators: %s: settings key name */
						__( 'settings.%s must be a non-negative integer.', 'allfeedback' ),
						$key
					),
					422
				);
			}
		}

		if ( array_key_exists( 'target_page_ids', $settings ) ) {
			if ( ! is_array( $settings['target_page_ids'] ) ) {
				return $this->errorResponse(
					__( 'settings.target_page_ids must be an array.', 'allfeedback' ),
					422
				);
			}
			foreach ( $settings['target_page_ids'] as $pid ) {
				if ( filter_var( $pid, FILTER_VALIDATE_INT ) === false || (int) $pid < 1 ) {
					return $this->errorResponse(
						__( 'settings.target_page_ids must contain only positive integers.', 'allfeedback' ),
						422
					);
				}
			}
		}

		return true;
	}

	/**
	 * Validate the styling parameter before persisting it.
	 *
	 * Allowed keys and their constraints:
	 *   widget_position — enum: bottom-right, bottom-left, side-tab, or empty string
	 *   widget_icon     — string (arbitrary icon identifier), max 64 chars
	 *   widget_label    — string (launcher button text), max 80 chars
	 *   widget_color    — string (CSS colour value), max 30 chars
	 *
	 * @param  mixed $styling Raw styling value from the request.
	 * @return true|\WP_Error
	 * @since  1.0.0
	 */
	private function validateStyling( mixed $styling ): true|\WP_Error {
		if ( $styling === null || $styling === '' ) {
			return true;
		}

		$styling = $this->normaliseJsonParam( $styling );

		if ( $styling === null ) {
			return $this->errorResponse( __( 'styling must be a valid JSON object.', 'allfeedback' ), 422 );
		}

		$allowed_positions = apply_filters(
			'allfeedback_styling_allowed_widget_positions',
			[ '', 'bottom-right', 'bottom-left', 'side-tab' ]
		);

		if ( array_key_exists( 'widget_position', $styling ) ) {
			if ( ! in_array( $styling['widget_position'], $allowed_positions, true ) ) {
				return $this->errorResponse(
					sprintf(
						/* translators: %s: submitted value */
						__( 'Invalid styling.widget_position "%s". Allowed: bottom-right, bottom-left, side-tab, or empty string.', 'allfeedback' ),
						sanitize_text_field( (string) $styling['widget_position'] )
					),
					422
				);
			}
		}

		$allowed_progress_indicators = apply_filters(
			'allfeedback_styling_allowed_progress_indicators',
			[ 'dots', 'numbers', 'bar', 'none' ]
		);

		if ( array_key_exists( 'progress_indicator', $styling ) ) {
			if ( ! in_array( $styling['progress_indicator'], $allowed_progress_indicators, true ) ) {
				return $this->errorResponse(
					sprintf(
						/* translators: %s: submitted value */
						\__( 'Invalid styling.progress_indicator "%s". Allowed: dots, numbers, bar, none.', 'allfeedback' ),
						sanitize_key( (string) $styling['progress_indicator'] )
					),
					422
				);
			}
		}

		if ( array_key_exists( 'widget_icon', $styling ) && ! is_string( $styling['widget_icon'] ) ) {
			return $this->errorResponse(
				\__( 'styling.widget_icon must be a string.', 'allfeedback' ),
				422
			);
		}

		return true;
	}

	/**
	 * Extract section and field counts from a form_schema array.
	 *
	 * @param  array<string, mixed>|null $schema Decoded form_schema array.
	 * @return array{section_count: int, field_count: int}
	 * @since  1.0.0
	 */
	private function schemaStats( mixed $schema ): array {
		$stats = [
			'section_count' => 0,
			'field_count' => 0,
		];

		if ( $schema === null || $schema === '' || $schema === [] ) {
			return $stats;
		}

		$decoded = is_array( $schema ) ? $schema : ( is_string( $schema ) ? json_decode( $schema, true ) : null );

		if ( ! is_array( $decoded ) || empty( $decoded['sections'] ) || ! is_array( $decoded['sections'] ) ) {
			return $stats;
		}

		$stats['section_count'] = count( $decoded['sections'] );

		foreach ( $decoded['sections'] as $section ) {
			$section = (array) $section;
			if ( ! empty( $section['fields'] ) && is_array( $section['fields'] ) ) {
				$stats['field_count'] += count( $section['fields'] );
			}
		}

		return $stats;
	}

	/**
	 * Normalise a JSON parameter to an associative array regardless of how
	 * the REST client delivered it.
	 *
	 * WordPress decodes application/json bodies with json_decode (assoc=false),
	 * so objects arrive as stdClass. Some clients send pre-encoded JSON strings.
	 * This method handles all three forms and returns a plain array, or null on failure.
	 *
	 * @param  mixed $value Raw parameter value.
	 * @return array<string, mixed>|null
	 * @since  1.0.0
	 */
	private function normaliseJsonParam( mixed $value ): ?array {
		if ( is_array( $value ) ) {
			return $value;
		}

		if ( is_object( $value ) ) {
			return (array) $value;
		}

		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			return is_array( $decoded ) ? $decoded : null;
		}

		return null;
	}
}
