<?php
/**
 * Wpdb survey repository.
 *
 * @package AllFeedback\Infrastructure\Database\Repositories
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\Infrastructure\Database\Repositories;

defined( 'ABSPATH' ) || exit;

use AllFeedback\Domain\Survey\Survey;
use AllFeedback\Domain\Survey\SurveyFilter;
use AllFeedback\Domain\Survey\SurveyRepository;
use AllFeedback\Domain\Survey\SurveyStatus;
use DateTimeImmutable;

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter

/**
 * Wpdb-backed implementation of SurveyRepository.
 *
 * Persists Survey aggregates to the custom `{prefix}af_surveys` table.
 * JSON columns (form_schema, settings, targeting) are encoded on write and
 * decoded on read so that the domain layer always works with PHP arrays.
 *
 * @package AllFeedback\Infrastructure\Database\Repositories
 * @since   1.0.0
 */
class WpdbSurveyRepository implements SurveyRepository {

	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $this->table is a trusted class property, never user input

	/**
	 * Fully-qualified table name including the wpdb prefix.
	 *
	 * @var string
	 * @since 1.0.0
	 */
	private string $table;

	/**
	 * Column names permitted as ORDER BY targets to prevent SQL injection.
	 *
	 * @var string[]
	 * @since 1.0.0
	 */
	private const ALLOWED_ORDERBY = [
		'id',
		'title',
		'status',
		'response_count',
		'created_at',
		'updated_at',
	];

	/**
	 * Constructor.
	 *
	 * @since  1.0.0
	 */
	public function __construct() {
		global $wpdb;
		$this->table = $wpdb->prefix . 'af_surveys';
	}

	/**
	 * Persist a new or updated Survey and return the saved instance.
	 *
	 * @param  Survey $survey The aggregate to persist.
	 * @return Survey The saved instance with its persistence ID assigned.
	 * @since  1.0.0
	 */
	public function save( Survey $survey ): Survey {
		return $survey->isNew() ? $this->insert( $survey ) : $this->update( $survey );
	}

	/**
	 * Retrieve a single Survey by its primary key, or null if not found.
	 *
	 * @param  int $id Survey primary key.
	 * @return Survey|null
	 * @since  1.0.0
	 */
	public function findById( int $id ): ?Survey {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$this->table} WHERE id = %d LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$id
			),
			ARRAY_A
		);

		return $row ? $this->hydrate( $row ) : null;
	}

	/**
	 * Retrieve all Surveys matching the given filter.
	 *
	 * @param  SurveyFilter $filter Query constraints and pagination.
	 * @return Survey[]
	 * @since  1.0.0
	 */
	public function findAll( SurveyFilter $filter ): array {
		global $wpdb;

		[ $where, $params ] = $this->buildFilterQuery( $filter );

		$order_by = in_array( $filter->order_by, self::ALLOWED_ORDERBY, true ) ? $filter->order_by : 'created_at';
		$order    = strtoupper( $filter->order ) === 'ASC' ? 'ASC' : 'DESC';
		$limit    = max( 1, $filter->per_page );
		$offset   = max( 0, ( $filter->page - 1 ) * $limit );

		$where_clause = $where !== [] ? 'WHERE ' . implode( ' AND ', $where ) : '';
		$sql          = "SELECT * FROM {$this->table} {$where_clause} ORDER BY {$order_by} {$order} LIMIT %d OFFSET %d"; // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		$params[] = $limit;
		$params[] = $offset;

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $rows !== null && $rows !== false ? $rows : [];

		return array_map( [ $this, 'hydrate' ], $rows );
	}

	/**
	 * Count all Surveys matching the given filter.
	 *
	 * @param  SurveyFilter $filter Query constraints.
	 * @return int
	 * @since  1.0.0
	 */
	public function count( SurveyFilter $filter ): int {
		global $wpdb;

		[ $where, $params ] = $this->buildFilterQuery( $filter );

		if ( empty( $where ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$this->table}" );
		}

		$where_clause = 'WHERE ' . implode( ' AND ', $where );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$this->table} {$where_clause}", ...$params ) );
	}

	/**
	 * Permanently remove a Survey by its primary key.
	 *
	 * @param  int $id Survey primary key.
	 * @return bool True on success.
	 * @since  1.0.0
	 */
	public function delete( int $id ): bool {
		global $wpdb;
		return $wpdb->delete( $this->table, [ 'id' => $id ], [ '%d' ] ) !== false;
	}

	/**
	 * Atomically increment the denormalised response counter by one.
	 *
	 * @param  int $id Survey primary key.
	 * @return void
	 * @since  1.0.0
	 */
	public function incrementResponseCount( int $id ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( "UPDATE {$this->table} SET response_count = response_count + 1 WHERE id = %d", $id ) );
	}

	/**
	 * Atomically decrement the denormalised response counter (never below zero).
	 *
	 * @param  int $id Survey primary key.
	 * @return void
	 * @since  1.0.0
	 */
	public function decrementResponseCount( int $id ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( "UPDATE {$this->table} SET response_count = GREATEST(response_count - 1, 0) WHERE id = %d", $id ) );
	}

	/**
	 * Retrieve multiple surveys by their primary keys in one query, keyed by survey ID.
	 *
	 * @param  int[] $ids Survey primary keys.
	 * @return array<int, Survey>
	 * @since  1.0.0
	 */
	public function findByIds( array $ids ): array {
		if ( empty( $ids ) ) {
			return [];
		}

		global $wpdb;

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM `{$this->table}` WHERE id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				...$ids
			),
			ARRAY_A
		);
		$rows = $rows !== null && $rows !== false ? $rows : [];

		$result = [];
		foreach ( $rows as $row ) {
			$survey                     = $this->hydrate( $row );
			$result[ $survey->getId() ] = $survey;
		}

		return $result;
	}

	/**
	 * Count published surveys and how many were created in the last 7 days, in one query.
	 *
	 * @return array{total: int, new_this_week: int}
	 * @since  1.0.0
	 */
	public function countPublishedWithNewCount(): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					COUNT(*)                                                              AS total,
					SUM(DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY))         AS new_this_week
				FROM `{$this->table}`
				WHERE status = %s",
				SurveyStatus::Published->value
			),
			ARRAY_A
		);

		return [
			'total'         => (int) ( $row['total'] ?? 0 ),
			'new_this_week' => (int) ( $row['new_this_week'] ?? 0 ),
		];
	}

	/**
	 * Insert a new Survey row and return the reconstituted instance with its assigned id.
	 *
	 * @param  Survey $survey The new aggregate to insert.
	 * @return Survey The reconstituted instance with the generated primary key.
	 * @throws \RuntimeException When the wpdb insert fails.
	 * @since  1.0.0
	 */
	private function insert( Survey $survey ): Survey {
		global $wpdb;

		$styling     = $survey->getStyling();
		$form_schema = $this->sanitizeFormSchema( $survey->getFormSchema() );

		$result = $wpdb->insert(
			$this->table,
			[
				'title'           => $survey->getTitle(),
				'description'     => $survey->getDescription(),
				'form_schema'     => wp_json_encode( $form_schema ),
				'settings'        => wp_json_encode( $survey->getSettings() ),
				'styling'         => $styling !== [] ? wp_json_encode( $styling ) : null,
				'targeting'       => wp_json_encode( $survey->getTargeting() ),
				'status'          => $survey->getStatus()->value,
				'conflict_reason' => $survey->getConflictReason(),
				'response_count'  => $survey->getResponseCount(),
				'created_by'      => $survey->getCreatedBy() !== 0 ? $survey->getCreatedBy() : null,
				'created_at'      => $survey->getCreatedAt()->format( 'Y-m-d H:i:s' ),
				'updated_at'      => $survey->getUpdatedAt()?->format( 'Y-m-d H:i:s' ),
			],
			[ '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s' ]
		);

		if ( false === $result ) {
			throw new \RuntimeException( 'Failed to insert survey: ' . esc_html( $wpdb->last_error ) );
		}

		return Survey::reconstitute(
			id: (int) $wpdb->insert_id,
			title: $survey->getTitle(),
			description: $survey->getDescription(),
			form_schema: $form_schema,
			settings: $survey->getSettings(),
			status: $survey->getStatus(),
			response_count: $survey->getResponseCount(),
			created_by: $survey->getCreatedBy(),
			created_at: $survey->getCreatedAt(),
			updated_at: $survey->getUpdatedAt(),
			styling: $survey->getStyling(),
			conflict_reason: $survey->getConflictReason(),
			targeting: $survey->getTargeting(),
		);
	}

	/**
	 * Update an existing Survey row.
	 *
	 * @param  Survey $survey The aggregate with updated field values.
	 * @return Survey The same instance after the update.
	 * @throws \RuntimeException When the wpdb update fails.
	 * @since  1.0.0
	 */
	private function update( Survey $survey ): Survey {
		global $wpdb;

		$styling     = $survey->getStyling();
		$form_schema = $this->sanitizeFormSchema( $survey->getFormSchema() );

		$result = $wpdb->update(
			$this->table,
			[
				'title'           => $survey->getTitle(),
				'description'     => $survey->getDescription(),
				'form_schema'     => wp_json_encode( $form_schema ),
				'settings'        => wp_json_encode( $survey->getSettings() ),
				'styling'         => $styling !== [] ? wp_json_encode( $styling ) : null,
				'targeting'       => wp_json_encode( $survey->getTargeting() ),
				'status'          => $survey->getStatus()->value,
				'conflict_reason' => $survey->getConflictReason(),
				'response_count'  => $survey->getResponseCount(),
				'updated_at'      => current_time( 'mysql' ),
			],
			[ 'id' => $survey->getId() ],
			[ '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s' ],
			[ '%d' ]
		);

		if ( false === $result ) {
			throw new \RuntimeException( 'Failed to update survey: ' . esc_html( $wpdb->last_error ) );
		}

		return $survey;
	}

	/**
	 * Strip unsafe markup from field labels, which the widget renders as HTML.
	 *
	 * @param  array<mixed> $schema Form schema, possibly holding stdClass nodes from a REST body.
	 * @return array<mixed> Schema with every field label passed through wp_kses_post().
	 * @since  1.1.1
	 */
	private function sanitizeFormSchema( array $schema ): array {
		$normalised = json_decode( (string) wp_json_encode( $schema ), true );

		if ( ! is_array( $normalised ) ) {
			return $schema;
		}

		if ( isset( $normalised['sections'] ) && is_array( $normalised['sections'] ) ) {
			foreach ( $normalised['sections'] as $index => $section ) {
				if ( is_array( $section ) && isset( $section['fields'] ) && is_array( $section['fields'] ) ) {
					$normalised['sections'][ $index ]['fields'] = $this->sanitizeFieldLabels( $section['fields'] );
				}
			}

			return $normalised;
		}

		return array_is_list( $normalised ) ? $this->sanitizeFieldLabels( $normalised ) : $normalised;
	}

	/**
	 * Run wp_kses_post() over the label of each field in a list.
	 *
	 * @param  array<mixed> $fields Field definitions.
	 * @return array<mixed>
	 * @since  1.1.1
	 */
	private function sanitizeFieldLabels( array $fields ): array {
		foreach ( $fields as $index => $field ) {
			if ( is_array( $field ) && isset( $field['label'] ) && is_string( $field['label'] ) ) {
				$fields[ $index ]['label'] = wp_kses_post( $field['label'] );
			}
		}

		return $fields;
	}

	/**
	 * Hydrate a Survey aggregate from a raw database row.
	 *
	 * @param  array<string, mixed> $row Raw associative array from wpdb.
	 * @return Survey
	 * @since  1.0.0
	 */
	private function hydrate( array $row ): Survey {
		return Survey::reconstitute(
			id: (int) $row['id'],
			title: (string) $row['title'],
			description: (string) ( $row['description'] ?? '' ),
			form_schema: $this->decodeJson( (string) ( $row['form_schema'] ?? '' ) ),
			settings: $this->decodeJson( (string) ( $row['settings'] ?? '' ) ),
			status: SurveyStatus::from( $row['status'] ),
			response_count: (int) ( $row['response_count'] ?? 0 ),
			created_by: (int) ( $row['created_by'] ?? 0 ),
			created_at: new DateTimeImmutable( (string) $row['created_at'] ),
			updated_at: ! empty( $row['updated_at'] ) ? new DateTimeImmutable( (string) $row['updated_at'] ) : null,
			styling: $this->decodeJson( (string) ( $row['styling'] ?? '' ) ),
			conflict_reason: isset( $row['conflict_reason'] ) && $row['conflict_reason'] !== '' ? (string) $row['conflict_reason'] : null,
			targeting: $this->decodeJson( (string) ( $row['targeting'] ?? '' ) ),
		);
	}

	/**
	 * Build the WHERE conditions and parameter list from a SurveyFilter.
	 *
	 * @param  SurveyFilter $filter Query constraints.
	 * @return array{0: string[], 1: mixed[]}
	 * @since  1.0.0
	 */
	private function buildFilterQuery( SurveyFilter $filter ): array {
		global $wpdb;

		$where  = [];
		$params = [];

		if ( $filter->status !== null ) {
			$where[]  = 'status = %s';
			$params[] = $filter->status->value;
		}

		if ( $filter->created_by !== null ) {
			$where[]  = 'created_by = %d';
			$params[] = $filter->created_by;
		}

		if ( $filter->search !== null && $filter->search !== '' ) {
			$where[]  = 'title LIKE %s';
			$params[] = '%' . $wpdb->esc_like( $filter->search ) . '%';
		}

		if ( $filter->created_after !== null && $filter->created_after !== '' ) {
			$where[]  = 'DATE(created_at) >= %s';
			$params[] = $filter->created_after;
		}

		return [ $where, $params ];
	}

	/**
	 * Decode a JSON string to an array, returning an empty array on failure.
	 *
	 * @param  string $json JSON-encoded string.
	 * @return array<mixed>
	 * @since  1.0.0
	 */
	private function decodeJson( string $json ): array {
		if ( $json === '' ) {
			return [];
		}

		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : [];
	}
}
