<?php
/**
 * Development-only REST controller for seeding and clearing test data.
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\API\Controllers\V1;

defined( 'ABSPATH' ) || exit;

use AllFeedback\API\RestController;

/**
 * Class DevToolsController
 *
 * Development-only REST controller for seeding and clearing fake data.
 * Routes are only registered when WP_DEBUG is enabled.
 *
 * Routes (under allfeedback/v1):
 *   POST   /dev-tools/seed   → seed()   : insert fake surveys + responses + sessions
 *   DELETE /dev-tools/seed   → clear()  : delete all seeded data
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */
class DevToolsController extends RestController {

	/**
	 * Route base for dev-tools endpoints.
	 *
	 * @var string
	 * @since 1.0.0
	 */
	protected string $rest_base = 'dev-tools';

	private const SEEDED_META_KEY = '_allfeedback_seeded';

	private const COMMENTS = [
		'Great product, really love it!',
		'Could be better in some areas.',
		'Very satisfied with the service.',
		'The support team was very helpful.',
		'Easy to use and intuitive.',
		'Some features are missing.',
		'Excellent experience overall.',
		'Needs improvement in performance.',
		'Would definitely recommend to others.',
		'Not what I expected.',
		'Fantastic! Exceeded my expectations.',
		'Average experience, nothing special.',
		'The interface is very clean and modern.',
		'Had a few issues but they were resolved quickly.',
		'Outstanding customer service!',
		'Good value for money.',
		'A bit expensive but definitely worth it.',
		'Could use more detailed documentation.',
		'Seamless experience from start to finish.',
		'Still learning how to use all the features.',
		'Best tool I have used this year.',
		'Takes some getting used to but great once you do.',
		'Very responsive support team.',
		'Wish there were more third-party integrations.',
		'Loved the onboarding process.',
		'Setup was a bit confusing at first.',
		'Works exactly as advertised.',
		'Would love to see a dark mode option.',
		'Solid product with great potential.',
		'Looking forward to future updates.',
	];

	private const SHORT_ANSWERS = [
		'Very easy to navigate.',
		'Could be faster.',
		'Loved the design.',
		'Support was great.',
		'Missing some integrations.',
		'Works well on mobile.',
		'Setup took a while.',
		'Would use again.',
		'Needs better documentation.',
		'Great onboarding experience.',
	];

	private const FORM_TEMPLATES = [
		[ 'NPS Customer Satisfaction', 'How likely are you to recommend us to a friend?', 0 ],
		[ 'Product Feedback', 'Tell us about your experience with our product.', 1 ],
		[ 'Support Experience', 'Rate your recent support interaction.', 2 ],
		[ 'Website Usability', 'Help us improve our website.', 3 ],
		[ 'Onboarding Feedback', 'Tell us about your onboarding experience.', 4 ],
		[ 'Checkout Experience', 'Rate your checkout experience.', 2 ],
		[ 'Feature Request Pulse', 'What features should we build next?', 5 ],
		[ 'Post-Purchase Survey', 'How was your purchase experience?', 0 ],
		[ 'Event Feedback', 'Rate our most recent event.', 1 ],
		[ 'Annual Brand Survey', 'Your annual brand perception check-in.', 6 ],
		[ 'Mobile App Review', 'Tell us how our mobile app feels to use.', 0 ],
		[ 'Beta Feature Feedback', 'You tried our beta — what did you think?', 3 ],
		[ 'Cancellation Survey', 'Help us understand why you are leaving.', 5 ],
		[ 'Renewal Satisfaction', 'How do you feel about renewing with us?', 2 ],
		[ 'Partner Portal Feedback', 'Rate your partner portal experience.', 1 ],
		[ 'Documentation Quality', 'How helpful is our documentation?', 4 ],
		[ 'Pricing Perception', 'Do you feel our pricing is fair?', 3 ],
		[ 'Sales Call Experience', 'How did your sales conversation go?', 6 ],
		[ 'Employee Engagement', 'Rate your experience working with our team.', 2 ],
		[ 'Community Feedback', 'How do you find our community forums?', 0 ],
	];

	private const DEVICES = [ 'desktop', 'mobile', 'tablet' ];

	/**
	 * Build a form schema and response-data generator config for a given schema type.
	 *
	 * Returns:
	 *   'schema'       - PHP array (to be JSON-encoded)
	 *   'score_range'  - [min, max] or null if no numeric score
	 *   'fields'       - ordered list of field configs for fake-data generation
	 *
	 * @param int $type Schema type index 0-6.
	 */
	private static function schemaConfig( int $type ): array {
		switch ( $type ) {
			case 0: // NPS + long text.
				return [
					'schema'      => [
						'version' => '1.0',
						'sections' => [
							[
								'id' => 's1',
								'title' => 'Feedback',
								'fields' => [
									[
										'id' => 'f1',
										'type' => 'nps',
										'label' => 'How likely are you to recommend us to a friend or colleague?',
										'required' => true,
										'settings' => [],
									],
									[
										'id' => 'f2',
										'type' => 'long_text',
										'label' => 'What is the main reason for your score?',
										'required' => false,
										'settings' => [],
									],
								],
							],
						],
					],
					'score_range' => [ 0, 10 ],
					'fields'      => [
						[
							'id' => 'f1',
							'type' => 'nps',
						],
						[
							'id' => 'f2',
							'type' => 'long_text',
						],
					],
				];

			case 1: // Star rating + short text.
				return [
					'schema'      => [
						'version' => '1.0',
						'sections' => [
							[
								'id' => 's1',
								'title' => 'Rating',
								'fields' => [
									[
										'id' => 'f1',
										'type' => 'star_rating',
										'label' => 'How would you rate your overall experience?',
										'required' => true,
										'settings' => [
											'starRange' => 5,
											'starScale' => 'star',
										],
									],
									[
										'id' => 'f2',
										'type' => 'short_text',
										'label' => 'What could we improve?',
										'required' => false,
										'settings' => [ 'placeholder' => 'Type your answer…' ],
									],
								],
							],
						],
					],
					'score_range' => [ 1, 5 ],
					'fields'      => [
						[
							'id' => 'f1',
							'type' => 'star_rating',
							'min' => 1,
							'max' => 5,
						],
						[
							'id' => 'f2',
							'type' => 'short_text',
						],
					],
				];

			case 2: // Scale 1-10 + long text.
				return [
					'schema'      => [
						'version' => '1.0',
						'sections' => [
							[
								'id' => 's1',
								'title' => 'Satisfaction',
								'fields' => [
									[
										'id' => 'f1',
										'type' => 'scale',
										'label' => 'How satisfied are you with our service?',
										'required' => true,
										'settings' => [
											'scaleMin' => 1,
											'scaleMax' => 10,
											'scaleLowLabel' => 'Very unsatisfied',
											'scaleHighLabel' => 'Very satisfied',
										],
									],
									[
										'id' => 'f2',
										'type' => 'long_text',
										'label' => 'Tell us more about your experience.',
										'required' => false,
										'settings' => [],
									],
								],
							],
						],
					],
					'score_range' => [ 1, 10 ],
					'fields'      => [
						[
							'id' => 'f1',
							'type' => 'scale',
							'min' => 1,
							'max' => 10,
						],
						[
							'id' => 'f2',
							'type' => 'long_text',
						],
					],
				];

			case 3: // Radio + short text.
				return [
					'schema'      => [
						'version' => '1.0',
						'sections' => [
							[
								'id' => 's1',
								'title' => 'Quick Survey',
								'fields' => [
									[
										'id' => 'f1',
										'type' => 'radio',
										'label' => 'How did you hear about us?',
										'required' => true,
										'settings' => [ 'options' => [ 'Search engine', 'Social media', 'Friend or colleague', 'Advertisement', 'Other' ] ],
									],
									[
										'id' => 'f2',
										'type' => 'short_text',
										'label' => 'Any additional comments?',
										'required' => false,
										'settings' => [ 'placeholder' => 'Optional…' ],
									],
								],
							],
						],
					],
					'score_range' => null,
					'fields'      => [
						[
							'id' => 'f1',
							'type' => 'radio',
							'options' => [ 'Search engine', 'Social media', 'Friend or colleague', 'Advertisement', 'Other' ],
						],
						[
							'id' => 'f2',
							'type' => 'short_text',
						],
					],
				];

			case 4: // Checkboxes + long text.
				return [
					'schema'      => [
						'version' => '1.0',
						'sections' => [
							[
								'id' => 's1',
								'title' => 'Feature Survey',
								'fields' => [
									[
										'id' => 'f1',
										'type' => 'checkboxes',
										'label' => 'Which features do you use most?',
										'required' => true,
										'settings' => [ 'options' => [ 'Dashboard', 'Reports', 'Integrations', 'Automation', 'Support chat' ] ],
									],
									[
										'id' => 'f2',
										'type' => 'long_text',
										'label' => 'What features would you like to see next?',
										'required' => false,
										'settings' => [],
									],
								],
							],
						],
					],
					'score_range' => null,
					'fields'      => [
						[
							'id' => 'f1',
							'type' => 'checkboxes',
							'options' => [ 'Dashboard', 'Reports', 'Integrations', 'Automation', 'Support chat' ],
						],
						[
							'id' => 'f2',
							'type' => 'long_text',
						],
					],
				];

			case 5: // Radio choice + NPS (multi-page).
				return [
					'schema'      => [
						'version' => '1.0',
						'sections' => [
							[
								'id' => 's1',
								'title' => 'About You',
								'fields' => [
									[
										'id' => 'f1',
										'type' => 'radio',
										'label' => 'What best describes your role?',
										'required' => true,
										'settings' => [ 'options' => [ 'Developer', 'Designer', 'Manager', 'Marketing', 'Other' ] ],
									],
								],
							],
							[
								'id' => 's2',
								'title' => 'Your Opinion',
								'fields' => [
									[
										'id' => 'f2',
										'type' => 'nps',
										'label' => 'How likely are you to recommend us?',
										'required' => true,
										'settings' => [],
									],
									[
										'id' => 'f3',
										'type' => 'long_text',
										'label' => 'What would make you more likely to recommend us?',
										'required' => false,
										'settings' => [],
									],
								],
							],
						],
					],
					'score_range' => [ 0, 10 ],
					'fields'      => [
						[
							'id' => 'f1',
							'type' => 'radio',
							'options' => [ 'Developer', 'Designer', 'Manager', 'Marketing', 'Other' ],
						],
						[
							'id' => 'f2',
							'type' => 'nps',
						],
						[
							'id' => 'f3',
							'type' => 'long_text',
						],
					],
				];

			default: // case 6: Scale + checkboxes + short text (multi-page).
				return [
					'schema'      => [
						'version' => '1.0',
						'sections' => [
							[
								'id' => 's1',
								'title' => 'Experience',
								'fields' => [
									[
										'id' => 'f1',
										'type' => 'scale',
										'label' => 'How easy was it to achieve your goal?',
										'required' => true,
										'settings' => [
											'scaleMin' => 1,
											'scaleMax' => 7,
											'scaleLowLabel' => 'Very difficult',
											'scaleHighLabel' => 'Very easy',
										],
									],
								],
							],
							[
								'id' => 's2',
								'title' => 'Details',
								'fields' => [
									[
										'id' => 'f2',
										'type' => 'checkboxes',
										'label' => 'What obstacles did you encounter?',
										'required' => false,
										'settings' => [ 'options' => [ 'Confusing UI', 'Slow performance', 'Missing features', 'Poor documentation', 'None' ] ],
									],
									[
										'id' => 'f3',
										'type' => 'short_text',
										'label' => 'Anything else to share?',
										'required' => false,
										'settings' => [],
									],
								],
							],
						],
					],
					'score_range' => [ 1, 7 ],
					'fields'      => [
						[
							'id' => 'f1',
							'type' => 'scale',
							'min' => 1,
							'max' => 7,
						],
						[
							'id' => 'f2',
							'type' => 'checkboxes',
							'options' => [ 'Confusing UI', 'Slow performance', 'Missing features', 'Poor documentation', 'None' ],
						],
						[
							'id' => 'f3',
							'type' => 'short_text',
						],
					],
				];
		}
	}

	/**
	 * Generate fake response_data JSON and a score for a given schema config.
	 *
	 * @param array<string, mixed> $config Schema config produced by schemaConfig().
	 * @return array{0: string|false, 1: int|null}
	 */
	private static function fakeResponseData( array $config ): array {
		$data  = [];
		$score = null;

		foreach ( $config['fields'] as $i => $field ) {
			switch ( $field['type'] ) {
				case 'nps':
					$val                  = wp_rand( 0, 10 );
					$data[ $field['id'] ] = $val;
					if ( $i === 0 || $score === null ) {
						$score = $val;
					}
					break;

				case 'star_rating':
					$val                  = wp_rand( $field['min'] ?? 1, $field['max'] ?? 5 );
					$data[ $field['id'] ] = $val;
					if ( $score === null ) {
						$score = $val;
					}
					break;

				case 'scale':
					$val                  = wp_rand( $field['min'] ?? 1, $field['max'] ?? 10 );
					$data[ $field['id'] ] = $val;
					if ( $score === null ) {
						$score = $val;
					}
					break;

				case 'radio':
					$data[ $field['id'] ] = $field['options'][ array_rand( $field['options'] ) ];
					break;

				case 'checkboxes':
					$opts                 = $field['options'];
					$count                = wp_rand( 1, min( 3, count( $opts ) ) );
					$keys                 = (array) array_rand( $opts, $count );
					$data[ $field['id'] ] = array_values( array_map( fn( $k ) => $opts[ $k ], $keys ) );
					break;

				case 'short_text':
					$data[ $field['id'] ] = self::SHORT_ANSWERS[ array_rand( self::SHORT_ANSWERS ) ];
					break;

				case 'email':
					$data[ $field['id'] ] = 'respondent' . wp_rand( 1, 999 ) . '@example.com';
					break;

				case 'long_text':
				default:
					$data[ $field['id'] ] = self::COMMENTS[ array_rand( self::COMMENTS ) ];
					break;
			}
		}

		return [ wp_json_encode( $data ), $score ];
	}

	/**
	 * Generate a UUID v4 string.
	 */
	private static function uuid(): string {
		$b    = random_bytes( 16 );
		$b[6] = chr( ( ord( $b[6] ) & 0x0f ) | 0x40 );
		$b[8] = chr( ( ord( $b[8] ) & 0x3f ) | 0x80 );
		return vsprintf( '%s%s-%s-%s-%s-%s%s%s', str_split( bin2hex( $b ), 4 ) );
	}

	/**
	 * {@inheritDoc}
	 */
	public function registerRoutes(): void {
		if ( ! ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ) {
			return;
		}

		\register_rest_route(
			$this->namespace,
			"/{$this->rest_base}/seed",
			[
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'seed' ],
					'permission_callback' => [ $this, 'adminPermission' ],
					'args'                => [
						'surveys'              => [
							'type'    => 'integer',
							'default' => 5,
							'minimum' => 1,
							'maximum' => 20,
						],
						'responses_per_survey' => [
							'type'    => 'integer',
							'default' => 500,
							'minimum' => 10,
							'maximum' => 5000,
						],
					],
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'clear' ],
					'permission_callback' => [ $this, 'adminPermission' ],
				],
			]
		);

		\register_rest_route(
			$this->namespace,
			"/{$this->rest_base}/reset-wizard",
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'resetWizard' ],
				'permission_callback' => [ $this, 'adminPermission' ],
			]
		);

		\register_rest_route(
			$this->namespace,
			"/{$this->rest_base}/logs",
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'clearLogs' ],
				'permission_callback' => [ $this, 'adminPermission' ],
			]
		);

		\register_rest_route(
			$this->namespace,
			"/{$this->rest_base}/reset-settings",
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'resetSettings' ],
				'permission_callback' => [ $this, 'adminPermission' ],
			]
		);
	}

	/**
	 * Seed fake surveys, responses, and sessions.
	 *
	 * @param \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response
	 */
	public function seed( \WP_REST_Request $request ): \WP_REST_Response {
		global $wpdb;

		$num_surveys = (int) $request->get_param( 'surveys' );
		$per_survey  = (int) $request->get_param( 'responses_per_survey' );
		$admin_id    = get_current_user_id();
		$templates   = self::FORM_TEMPLATES;

		$settings = wp_json_encode(
			[
				'submitLabel'    => 'Submit',
				'nextLabel'      => 'Next',
				'backLabel'      => 'Back',
				'widgetLabel'    => 'Feedback',
				'triggerIcon'    => 'message',
				'widgetPosition' => 'bottom-right',
			]
		);

		$styling = wp_json_encode(
			[
				'color'    => '#6366F1',
				'position' => 'bottom-right',
				'trigger'  => 'auto',
				'delay'    => 0,
			]
		);

		$survey_ids      = [];
		$total_responses = 0;
		$total_sessions  = 0;

		for ( $i = 0; $i < $num_surveys; $i++ ) {
			[ $title, $desc, $schema_type ] = $templates[ $i % count( $templates ) ];

			if ( $i >= count( $templates ) ) {
				$title .= ' ' . ( (int) floor( $i / count( $templates ) ) + 1 );
			}

			$config = self::schemaConfig( $schema_type );
			$schema = wp_json_encode( $config['schema'] );

			$wpdb->insert(
				$wpdb->prefix . 'af_surveys',
				[
					'title'           => $title,
					'description'     => $desc,
					'form_schema'     => $schema,
					'settings'        => $settings,
					'styling'         => $styling,
					'status'          => 'published',
					'conflict_reason' => self::SEEDED_META_KEY,
					'created_by'      => $admin_id,
					'created_at'      => current_time( 'mysql' ),
					'updated_at'      => current_time( 'mysql' ),
				],
				[ '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s' ]
			);

			$survey_id    = (int) $wpdb->insert_id;
			$survey_ids[] = $survey_id;

			// Responses — build placeholder templates and a flat values array, then
			// pass everything through a single $wpdb->prepare() call per batch.
			$batch              = 500;
			$resp_placeholders  = [];
			$resp_values        = [];

			$flush_responses = static function () use ( &$resp_placeholders, &$resp_values, &$total_responses, $wpdb ) {
				if ( empty( $resp_placeholders ) ) {
					return;
				}
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$wpdb->query(
					$wpdb->prepare(
						"INSERT INTO {$wpdb->prefix}af_responses
							(survey_id, response_data, score, device_type, ip_hash, ip_address, is_read, created_at)
						 VALUES " . implode( ',', $resp_placeholders ), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
						...$resp_values
					)
				);
				$total_responses   += count( $resp_placeholders );
				$resp_placeholders  = [];
				$resp_values        = [];
			};

			for ( $j = 0; $j < $per_survey; $j++ ) {
				[ $data, $score ] = self::fakeResponseData( $config );
				$device    = self::DEVICES[ array_rand( self::DEVICES ) ];
				$is_read   = wp_rand( 0, 1 );
				$days_ago  = wp_rand( 0, 730 );
				$created   = gmdate( 'Y-m-d H:i:s', strtotime( "-{$days_ago} days" ) );
				$ip        = wp_rand( 1, 255 ) . '.' . wp_rand( 0, 255 ) . '.' . wp_rand( 0, 255 ) . '.' . wp_rand( 0, 255 );
				$ip_hash   = hash( 'sha256', $ip );

				if ( $score !== null ) {
					$resp_placeholders[] = '(%d,%s,%d,%s,%s,%s,%d,%s)';
					array_push( $resp_values, $survey_id, $data, $score, $device, $ip_hash, $ip, $is_read, $created );
				} else {
					$resp_placeholders[] = '(%d,%s,NULL,%s,%s,%s,%d,%s)';
					array_push( $resp_values, $survey_id, $data, $device, $ip_hash, $ip, $is_read, $created );
				}

				if ( count( $resp_placeholders ) >= $batch ) {
					$flush_responses();
				}
			}
			$flush_responses();

			// Sync response_count cache.
			$actual_count = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->prefix}af_responses WHERE survey_id = %d",
					$survey_id
				)
			);
			$wpdb->update(
				$wpdb->prefix . 'af_surveys',
				[ 'response_count' => $actual_count ],
				[ 'id' => $survey_id ],
				[ '%d' ],
				[ '%d' ]
			);

			// Sessions.
			// Submitted: per_survey; abandoned: ~30%; viewed-only: ~40%.
			$n_submitted = $per_survey;
			$n_abandoned = (int) round( $per_survey * 0.30 );
			$n_viewed    = (int) round( $per_survey * 0.40 );

			// Sessions — same placeholder + flat-values pattern as responses above.
			$sess_placeholders = [];
			$sess_values       = [];

			$flush_sessions = static function () use ( &$sess_placeholders, &$sess_values, &$total_sessions, $wpdb ) {
				if ( empty( $sess_placeholders ) ) {
					return;
				}
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$wpdb->query(
					$wpdb->prepare(
						"INSERT INTO {$wpdb->prefix}af_survey_sessions
							(survey_id, session_id, guest_id, status, started_at, submitted_at, abandoned_at, last_active_at, created_at)
						 VALUES " . implode( ',', $sess_placeholders ), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
						...$sess_values
					)
				);
				$total_sessions    += count( $sess_placeholders );
				$sess_placeholders  = [];
				$sess_values        = [];
			};

			// Submitted sessions.
			for ( $j = 0; $j < $n_submitted; $j++ ) {
				$days_ago          = wp_rand( 0, 730 );
				$ts                = strtotime( "-{$days_ago} days" );
				$created           = gmdate( 'Y-m-d H:i:s', $ts );
				$started           = gmdate( 'Y-m-d H:i:s', $ts + wp_rand( 5, 60 ) );
				$submitted         = gmdate( 'Y-m-d H:i:s', $ts + wp_rand( 90, 600 ) );
				$sess_placeholders[] = "(%d,%s,%s,'submitted',%s,%s,NULL,%s,%s)";
				array_push( $sess_values, $survey_id, self::uuid(), self::uuid(), $started, $submitted, $submitted, $created );
				if ( count( $sess_placeholders ) >= $batch ) {
					$flush_sessions();
				}
			}

			// Abandoned sessions.
			for ( $j = 0; $j < $n_abandoned; $j++ ) {
				$days_ago          = wp_rand( 0, 730 );
				$ts                = strtotime( "-{$days_ago} days" );
				$created           = gmdate( 'Y-m-d H:i:s', $ts );
				$started           = gmdate( 'Y-m-d H:i:s', $ts + wp_rand( 5, 60 ) );
				$abandoned         = gmdate( 'Y-m-d H:i:s', $ts + wp_rand( 15, 120 ) );
				$sess_placeholders[] = "(%d,%s,%s,'started',%s,NULL,%s,%s,%s)";
				array_push( $sess_values, $survey_id, self::uuid(), self::uuid(), $started, $abandoned, $abandoned, $created );
				if ( count( $sess_placeholders ) >= $batch ) {
					$flush_sessions();
				}
			}

			// Viewed-only sessions.
			for ( $j = 0; $j < $n_viewed; $j++ ) {
				$days_ago          = wp_rand( 0, 730 );
				$ts                = strtotime( "-{$days_ago} days" );
				$created           = gmdate( 'Y-m-d H:i:s', $ts );
				$last_active       = gmdate( 'Y-m-d H:i:s', $ts + wp_rand( 3, 30 ) );
				$sess_placeholders[] = "(%d,%s,%s,'viewed',NULL,NULL,NULL,%s,%s)";
				array_push( $sess_values, $survey_id, self::uuid(), self::uuid(), $last_active, $created );
				if ( count( $sess_placeholders ) >= $batch ) {
					$flush_sessions();
				}
			}

			$flush_sessions();
		}

		return $this->successResponse(
			[
				'surveys'   => count( $survey_ids ),
				'responses' => $total_responses,
				'sessions'  => $total_sessions,
				'survey_ids' => $survey_ids,
			]
		);
	}

	/**
	 * Delete all seeded surveys, their responses, and their sessions.
	 */
	public function clear(): \WP_REST_Response {
		global $wpdb;

		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}af_surveys WHERE conflict_reason = %s",
				self::SEEDED_META_KEY
			)
		);

		if ( empty( $ids ) ) {
			return $this->successResponse(
				[
					'deleted_surveys' => 0,
					'deleted_responses' => 0,
					'deleted_sessions' => 0,
				]
			);
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$deleted_sessions = (int) $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}af_survey_sessions WHERE survey_id IN ($placeholders)",  // phpcs:ignore
				...$ids
			)
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$deleted_responses = (int) $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}af_responses WHERE survey_id IN ($placeholders)",  // phpcs:ignore
				...$ids
			)
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$deleted_surveys = (int) $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}af_surveys WHERE id IN ($placeholders)",  // phpcs:ignore
				...$ids
			)
		);

		return $this->successResponse(
			[
				'deleted_surveys'   => $deleted_surveys,
				'deleted_responses' => $deleted_responses,
				'deleted_sessions'  => $deleted_sessions,
			]
		);
	}

	/**
	 * Reset the setup wizard status so it can be re-run.
	 */
	public function resetWizard(): \WP_REST_Response {
		\update_option( 'allfeedback_wizard_status', 'not_started' );
		\delete_option( '_allfeedback_wizard_data' );
		return $this->successResponse( [ 'reset' => true ] );
	}

	/**
	 * Clear all plugin logs.
	 */
	public function clearLogs(): \WP_REST_Response {
		global $wpdb;
		$deleted = (int) $wpdb->query( "DELETE FROM {$wpdb->prefix}af_logs" ); // phpcs:ignore
		return $this->successResponse( [ 'deleted' => $deleted ] );
	}

	/**
	 * Reset plugin settings to defaults.
	 */
	public function resetSettings(): \WP_REST_Response {
		\delete_option( '_allfeedback_settings' );
		return $this->successResponse( [ 'reset' => true ] );
	}
}
