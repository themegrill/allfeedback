<?php
/**
 * Logs controller.
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\API\Controllers\V1;

defined( 'ABSPATH' ) || exit;

use AllFeedback\API\RestController;
use AllFeedback\Support\Logger;

/**
 * Class LogsController
 *
 * REST controller for plugin log file management.
 *
 * Routes (under allfeedback/v1):
 *   GET    /logs              → index()        : paginated list of log files
 *   GET    /logs/{id}        → show()         : single log file with full content
 *   DELETE /logs/delete      → bulkDelete()   : bulk-delete multiple log files
 *   DELETE /logs/{id}        → destroy()      : delete a single log file
 *
 * Note: /logs/delete is registered before /logs/{id} so the literal segment
 * "delete" is matched first by WordPress's router.
 *
 * ── Log file identity ─────────────────────────────────────────────────────
 *
 * Each log file is identified by its stem without the .log extension.
 * Example: file "allfeedback-2026-04-13.log" → id "allfeedback-2026-04-13".
 *
 * The id is URL-safe (lowercase, hyphens) so no encoding is needed.
 *
 * ── Security ─────────────────────────────────────────────────────────────
 *
 * All routes require manage_options. Log content is never exposed as a
 * direct file URL — it is served exclusively through this controller so
 * WordPress authentication always gates access.
 *
 * @package AllFeedback\API\Controllers\V1
 * @since   1.0.0
 */
class LogsController extends RestController {

	/**
	 * REST resource slug.
	 *
	 * @var string
	 * @since 1.0.0
	 */
	protected string $rest_base = 'logs';

	/**
	 * Constructor.
	 *
	 * @param  Logger $logger Plugin logger (provides logDir() and entry count helpers).
	 * @since  1.0.0
	 */
	public function __construct(
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
					'args'                => array_merge(
						$this->paginationArgs( 20, 100 ),
						[
							'orderby' => $this->argEnum(
								__( 'Sort log files by attribute.', 'allfeedback' ),
								[ 'date', 'name', 'size' ],
								default: 'date',
							),
							'order'   => $this->argEnum(
								__( 'Sort direction.', 'allfeedback' ),
								[ 'asc', 'desc' ],
								default: 'desc',
							),
							'search'  => $this->argString(
								__( 'Filter log files by filename.', 'allfeedback' ),
								default: '',
							),
						]
					),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/delete',
			[
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'bulkDelete' ],
					'permission_callback' => [ $this, 'adminPermission' ],
					'args'                => [
						'ids' => [
							'description'       => __( 'Array of log file IDs to delete.', 'allfeedback' ),
							'type'              => 'array',
							'items'             => [ 'type' => 'string' ],
							'required'          => true,
							'minItems'          => 1,
							'validate_callback' => 'rest_validate_request_arg',
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>[a-z0-9_-]+)',
			[
				'args' => [
					'id' => [
						'description'       => __( 'Log file ID (filename stem without .log extension).', 'allfeedback' ),
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_file_name',
						'validate_callback' => 'rest_validate_request_arg',
					],
				],
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show' ],
					'permission_callback' => [ $this, 'adminPermission' ],
					'args'                => $this->paginationArgs( 100, 500 ),
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'destroy' ],
					'permission_callback' => [ $this, 'adminPermission' ],
				],
			]
		);
	}

	/**
	 * GET /allfeedback/v1/logs
	 *
	 * Return a paginated, filterable list of log files.
	 * Each item includes metadata but not the raw log content.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response
	 * @since  1.0.0
	 */
	public function index( \WP_REST_Request $request ): \WP_REST_Response {
		$page     = (int) $request->get_param( 'page' );
		$per_page = (int) $request->get_param( 'per_page' );
		$orderby  = (string) $request->get_param( 'orderby' );
		$order    = (string) $request->get_param( 'order' );
		$search   = (string) $request->get_param( 'search' );

		$files = $this->getLogFiles();

		if ( $search !== '' ) {
			$files = array_filter(
				$files,
				static fn( string $f ) => stripos( basename( $f ), $search ) !== false,
			);
		}

		// Stat each file once — avoids redundant syscalls inside usort + prepareItem.
		$stats = [];
		foreach ( $files as $f ) {
			$stats[ $f ] = [
				'mtime' => (int) filemtime( $f ),
				'size' => (int) filesize( $f ),
			];
		}

		usort(
			$files,
			static function ( string $a, string $b ) use ( $orderby, $order, $stats ): int {
				$result = match ( $orderby ) {
					'size' => $stats[ $a ]['size'] - $stats[ $b ]['size'],
					'name' => strcmp( basename( $a ), basename( $b ) ),
					default => $stats[ $a ]['mtime'] - $stats[ $b ]['mtime'],
				};
				return $order === 'asc' ? $result : -$result;
			}
		);

		$files = array_values( $files );
		$total = count( $files );
		$pages = (int) ceil( $total / $per_page );
		$files = array_slice( $files, ( $page - 1 ) * $per_page, $per_page );

		return $this->successResponse(
			[
				'logs'  => array_map( fn( string $f ) => $this->prepareItem( $f, $stats[ $f ] ), $files ),
				'total' => $total,
				'page'  => $page,
				'pages' => $pages,
			]
		);
	}

	/**
	 * GET /allfeedback/v1/logs/{id}
	 *
	 * Return metadata and the full content of a single log file.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function show( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$file = $this->resolveFile( (string) $request->get_param( 'id' ) );

		if ( $file === null ) {
			return $this->notFoundResponse( __( 'Log file', 'allfeedback' ) );
		}

		$page     = max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) );
		$per_page = min( 500, max( 10, (int) ( $request->get_param( 'per_page' ) ?? 100 ) ) );

		$stat = [
			'mtime' => (int) filemtime( $file ),
			'size' => (int) filesize( $file ),
		];
		$item = $this->prepareItem( $file, $stat );

		[ 'lines' => $lines, 'total' => $total ] = $this->readLines( $file, $page, $per_page );

		$item['lines']       = $lines;
		$item['total_lines'] = $total;
		$item['page']        = $page;
		$item['per_page']    = $per_page;
		$item['pages']       = (int) ceil( $total / $per_page );

		return $this->successResponse( $item );
	}

	/**
	 * DELETE /allfeedback/v1/logs/{id}
	 *
	 * Permanently delete a single log file.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function destroy( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$id   = (string) $request->get_param( 'id' );
		$file = $this->resolveFile( $id );

		if ( $file === null ) {
			return $this->notFoundResponse( __( 'Log file', 'allfeedback' ) );
		}

		wp_delete_file( $file );
		if ( file_exists( $file ) ) {
			return $this->errorResponse( __( 'Failed to delete log file.', 'allfeedback' ), 500 );
		}

		return $this->successResponse(
			[
				'deleted' => true,
				'id' => $id,
			]
		);
	}

	/**
	 * DELETE /allfeedback/v1/logs/delete
	 *
	 * Bulk-delete multiple log files in a single request.
	 *
	 * Always returns 200 — inspect `deleted`, `skipped`, and `failed`
	 * in the response body to detect partial failures.
	 *
	 * @param  \WP_REST_Request $request Full request data.
	 * @return \WP_REST_Response|\WP_Error
	 * @since  1.0.0
	 */
	public function bulkDelete( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		/** @var string[] $ids */ // phpcs:ignore Generic.Commenting.DocComment.MissingShort -- inline type hint
		$ids = $request->get_param( 'ids' );

		if ( empty( $ids ) || ! is_array( $ids ) ) {
			return $this->errorResponse( __( 'No log IDs provided.', 'allfeedback' ), 422 );
		}

		$deleted = [];
		$skipped = [];
		$failed  = [];

		foreach ( $ids as $id ) {
			$id   = sanitize_file_name( (string) $id );
			$file = $this->resolveFile( $id );

			if ( $file === null ) {
				$skipped[] = $id;
				continue;
			}

			wp_delete_file( $file );
			if ( ! file_exists( $file ) ) {
				$deleted[] = $id;
			} else {
				$failed[] = $id;
			}
		}

		return $this->successResponse(
			[
				'deleted' => $deleted,
				'skipped' => $skipped,
				'failed'  => $failed,
			]
		);
	}

	/**
	 * Return all .log files in the log directory, sorted by modification time
	 * descending by default (most recent first).
	 *
	 * @return string[] Absolute file paths.
	 * @since  1.0.0
	 */
	private function getLogFiles(): array {
		$files = glob( $this->logger->logDir() . '/allfeedback-*.log' );
		return is_array( $files ) ? $files : [];
	}

	/**
	 * Resolve a log file ID to its absolute path, or null if not found.
	 *
	 * Security: path is validated to be inside the log directory so that a
	 * crafted ID (e.g. "../../wp-config") cannot escape the directory.
	 *
	 * @param  string $id Log file stem (filename without .log extension).
	 * @return string|null Absolute path, or null if not found / outside log dir.
	 * @since  1.0.0
	 */
	private function resolveFile( string $id ): ?string {
		$log_dir = realpath( $this->logger->logDir() );

		if ( $log_dir === false ) {
			return null;
		}

		$file = realpath( $log_dir . '/' . $id . '.log' );

		if ( $file === false || strpos( $file, $log_dir ) !== 0 || ! is_file( $file ) ) {
			return null;
		}

		return $file;
	}

	/**
	 * Build the metadata array for a single log file.
	 *
	 * Accepts pre-computed stat data to avoid redundant syscalls when called
	 * in a loop (e.g. from index()).
	 *
	 * @param  string                         $file Absolute path to the log file.
	 * @param  array{mtime:int,size:int}|null $stat Pre-computed stat, or null to stat now.
	 * @return array<string, mixed>
	 * @since  1.0.0
	 */
	private function prepareItem( string $file, ?array $stat = null ): array {
		$stat ??= [
			'mtime' => (int) filemtime( $file ),
			'size' => (int) filesize( $file ),
		];

		return [
			'id'    => basename( $file, '.log' ),
			'name'  => basename( $file ),
			'size'  => round( $stat['size'] / 1024, 2 ) . ' KB',
			'bytes' => $stat['size'],
			'date'  => gmdate( 'c', $stat['mtime'] ),
		];
	}

	/**
	 * Read a paginated slice of lines from a log file without loading it all into memory.
	 *
	 * Streams the file line-by-line, skipping lines before the requested page
	 * and stopping once the page is full. Total line count is tracked in the
	 * same single pass — no second read needed.
	 *
	 * @param  string $file    Absolute path to the log file.
	 * @param  int    $page    1-based page number.
	 * @param  int    $per_page Lines per page.
	 * @return array{lines: string[], total: int}
	 * @since  1.0.0
	 */
	private function readLines( string $file, int $page, int $per_page ): array {
		$handle = @fopen( $file, 'r' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen, WordPress.PHP.NoSilencedErrors.Discouraged

		if ( ! is_resource( $handle ) ) {
			return [
				'lines' => [],
				'total' => 0,
			];
		}

		$offset = ( $page - 1 ) * $per_page;
		$lines  = [];
		$total  = 0;

		while ( ! feof( $handle ) ) {
			$line = fgets( $handle );
			if ( $line === false ) {
				break;
			}
			$line = rtrim( $line );
			if ( $line === '' ) {
				continue;
			}
			if ( $total >= $offset && count( $lines ) < $per_page ) {
				$lines[] = $line;
			}
			++$total;
		}

		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		return [
			'lines' => $lines,
			'total' => $total,
		];
	}
}
