<?php
/**
 * Admin service provider.
 *
 * @package AllFeedback\Admin
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\Admin;

defined( 'ABSPATH' ) || exit;

use AllFeedback\Core\Constants;
use AllFeedback\Core\Container;
use AllFeedback\Core\ServiceProvider;
use AllFeedback\Core\Settings\SettingsManager;
use AllFeedback\Domain\Response\ResponseRepository;
use AllFeedback\Support\AssetManager;
use AllFeedback\Traits\Hooks;
use DI\ContainerBuilder;

/**
 * Boots all WP-admin functionality for the All Feedback plugin.
 *
 * Responsibilities:
 *  - Top-level admin menu and hash-routed sub-menu pages.
 *  - Admin script/style enqueueing.
 *  - Inline JS that keeps the WP sidebar highlight in sync with the hash route.
 *
 * All page content is rendered by the React SPA mounted on `#ALLFB-Admin-Root`.
 * PHP callbacks output only the mount-point `<div>`; no server-side UI is
 * generated here.
 *
 * @package AllFeedback\Admin
 * @since   1.0.0
 */
class AdminServiceProvider implements ServiceProvider {

	use Hooks;

	/**
	 * The mount-point element ID that React attaches to.
	 *
	 * @since 1.0.0
	 */
	private const MOUNT_ID = 'ALLFB-Admin-Root';

	/**
	 * WordPress menu slug for the top-level admin page.
	 *
	 * @since 1.0.0
	 */
	private const MENU_SLUG = 'allfeedback';

	/**
	 * Constructor.
	 *
	 * @param  Container          $container          DI container.
	 * @param  AssetManager       $asset_manager       Asset enqueueing helper.
	 * @param  ResponseRepository $response_repository Response repository for unread count badge.
	 * @param  SettingsManager    $settings_manager    Plugin settings.
	 * @since  1.0.0
	 */
	public function __construct(
		private readonly Container $container,
		private readonly AssetManager $asset_manager,
		private readonly ResponseRepository $response_repository,
		private readonly SettingsManager $settings_manager,
	) {}

	/**
	 * {@inheritDoc}
	 *
	 * @param  ContainerBuilder $builder PHP-DI builder instance.
	 * @return void
	 * @since  1.0.0
	 */
	public function register( ContainerBuilder $builder ): void {}

	/**
	 * Wire up WordPress hooks for the admin context.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function boot(): void {
		$this->addAction( 'admin_menu', [ $this, 'registerMenus' ] );
		$this->addAction( 'allfeedback:enqueue-assets:admin', [ $this, 'enqueueAssets' ] );
		$this->addAction( 'in_admin_header', [ $this, 'suppressAdminNotices' ] );
		$this->addAction( 'admin_init', [ $this, 'maybeRedirectToWizard' ] );
	}

	/**
	 * Register the top-level menu and hash-routed sub-menu pages.
	 *
	 * Each sub-menu slug contains the hash fragment for its React route
	 * (e.g. `'allfeedback#/settings'`). WordPress puts the fragment in the
	 * sidebar link `href` so clicking it navigates the SPA directly. All
	 * callbacks output only the React mount point.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function registerMenus(): void {
		$mount_point = static function (): void {
			echo '<div id="' . esc_attr( self::MOUNT_ID ) . '"></div>';
		};

		$menu_icon = 'data:image/svg+xml;base64,' . base64_encode( // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- encoding an SVG data URI, not obfuscating code
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">'
			. '<path d="M112 0C120.837 0 128 7.16344 128 16V112C128 120.837 120.837 128 112 128H16C7.16344 128 0 120.837 0 112V16C0 7.16344 7.16344 0 16 0H112ZM105.165 37.7334C105.165 29.5231 98.0074 23.1475 89.8516 24.0928L35.1514 30.4326C28.2254 31.2354 23.0002 37.1019 23 44.0742V80.04C23.0005 87.5099 28.9652 93.5867 36.3916 93.7676V103.146C36.392 106.043 39.5758 107.811 42.0352 106.281L62.1367 93.7725H91.4326C99.0165 93.7724 105.165 87.6238 105.165 80.04V37.7334ZM90.543 30.0527C95.135 29.5208 99.1646 33.1107 99.165 37.7334V80.04C99.1646 84.3101 95.7028 87.7724 91.4326 87.7725H60.2744V87.8643L42.3916 98.9922V87.7705H36.6602C32.4232 87.7317 29.0005 84.286 29 80.04V44.0742C29.0002 40.1485 31.9422 36.8457 35.8418 36.3936L90.543 30.0527ZM43.8916 58.8916C42.2349 58.8916 40.8918 60.2349 40.8916 61.8916V74.8916C40.8916 76.5484 42.2348 77.8916 43.8916 77.8916C45.5484 77.8916 46.8916 76.5484 46.8916 74.8916V61.8916C46.8914 60.2349 45.5484 58.8916 43.8916 58.8916ZM56.8916 46.8916C55.2349 46.8916 53.8918 48.2349 53.8916 49.8916V74.8916C53.8916 76.5484 55.2348 77.8916 56.8916 77.8916C58.5484 77.8916 59.8916 76.5484 59.8916 74.8916V49.8916C59.8914 48.2349 58.5484 46.8916 56.8916 46.8916ZM69.8916 51.8916C68.2348 51.8916 66.8918 53.2349 66.8916 54.8916V74.8916C66.8916 76.5484 68.2348 77.8916 69.8916 77.8916C71.5484 77.8916 72.8916 76.5484 72.8916 74.8916V54.8916C72.8914 53.2349 71.5484 51.8916 69.8916 51.8916ZM82.8916 38.8916C81.2348 38.8916 79.8918 40.2349 79.8916 41.8916V74.8916C79.8916 76.5484 81.2348 77.8916 82.8916 77.8916C84.5484 77.8916 85.8916 76.5484 85.8916 74.8916V41.8916C85.8914 40.2349 84.5484 38.8916 82.8916 38.8916Z" fill="#605CFF"/>'
			. '</svg>'
		);

		add_menu_page(
			page_title: __( 'All Feedback', 'allfeedback' ),
			menu_title: __( 'AllFeedback', 'allfeedback' ),
			capability: 'manage_options',
			menu_slug:  self::MENU_SLUG,
			callback:   $mount_point,
			icon_url:   $menu_icon,
			position:   30,
		);

		add_submenu_page(
			parent_slug: self::MENU_SLUG,
			page_title:  __( 'Analytics', 'allfeedback' ),
			menu_title:  __( 'Analytics', 'allfeedback' ),
			capability:  'manage_options',
			menu_slug:   self::MENU_SLUG . '#/analytics',
			callback:    $mount_point,
		);

		add_submenu_page(
			parent_slug: self::MENU_SLUG,
			page_title:  __( 'All Forms', 'allfeedback' ),
			menu_title:  __( 'All Forms', 'allfeedback' ),
			capability:  'manage_options',
			menu_slug:   self::MENU_SLUG . '#/forms',
			callback:    $mount_point,
		);

		$unread_count    = $this->response_repository->countUnread();
		$responses_title = __( 'Responses', 'allfeedback' );

		if ( $unread_count > 0 ) {
			$responses_title .= sprintf(
				' <span class="awaiting-mod count-%1$d"><span class="pending-count">%1$d</span></span>',
				$unread_count
			);
		}

		add_submenu_page(
			parent_slug: self::MENU_SLUG,
			page_title:  __( 'Responses', 'allfeedback' ),
			menu_title:  $responses_title,
			capability:  'manage_options',
			menu_slug:   self::MENU_SLUG . '#/responses',
			callback:    $mount_point,
		);

		add_submenu_page(
			parent_slug: self::MENU_SLUG,
			page_title:  __( 'Settings', 'allfeedback' ),
			menu_title:  __( 'Settings', 'allfeedback' ),
			capability:  'manage_options',
			menu_slug:   self::MENU_SLUG . '#/settings',
			callback:    $mount_point,
		);

		add_submenu_page(
			parent_slug: self::MENU_SLUG,
			page_title:  __( 'Tools', 'allfeedback' ),
			menu_title:  __( 'Tools', 'allfeedback' ),
			capability:  'manage_options',
			menu_slug:   self::MENU_SLUG . '#/tools',
			callback:    $mount_point,
		);

		add_submenu_page(
			parent_slug: self::MENU_SLUG,
			page_title:  __( 'About', 'allfeedback' ),
			menu_title:  __( 'About', 'allfeedback' ),
			capability:  'manage_options',
			menu_slug:   self::MENU_SLUG . '#/about',
			callback:    $mount_point,
		);

		remove_submenu_page( self::MENU_SLUG, self::MENU_SLUG );
	}

	/**
	 * Automatically redirect to the Setup Wizard after activation.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function maybeRedirectToWizard(): void {
		if ( wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$status = get_option( 'allfeedback_wizard_status', 'not_started' );
		if ( $status === 'pending_redirect' || $status === 'not_started' ) {
			update_option( 'allfeedback_wizard_status', 'initiated' );
			wp_safe_redirect( admin_url( 'admin.php?page=allfeedback#/wizard' ) );
			exit;
		}
	}


	/**
	 * Remove all third-party and WP core admin notices on AllFeedback pages.
	 *
	 * Fires on `'in_admin_header'` — after other plugins register their notices
	 * but before WordPress renders them — so notices can be stripped without
	 * affecting the rest of the admin.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function suppressAdminNotices(): void {
		$screen = get_current_screen();
		if ( ! $screen || ! str_contains( $screen->id, 'allfeedback' ) ) {
			return;
		}

		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );
	}

	/**
	 * Enqueue admin-only scripts and styles.
	 *
	 * @param  string $hook Current admin page hook suffix.
	 * @return void
	 * @since  1.0.0
	 */
	public function enqueueAssets( string $hook ): void {
		if ( ! str_contains( $hook, 'allfeedback' ) ) {
			return;
		}

		global $wpdb;

		$is_admin = current_user_can( 'manage_options' );
		$widget   = (array) $this->settings_manager->get( 'general.widget' );

		// Diagnostic system info is only resolved and exposed for administrators.
		$curl_str = null;
		if ( $is_admin && function_exists( 'curl_version' ) ) {
			$cv       = curl_version();
			$curl_str = $cv['version'] . ( ! empty( $cv['ssl_version'] ) ? ', ' . $cv['ssl_version'] : '' );
		}

		$admin_data = $this->applyFilters(
			'allfeedback:admin:script_data',
			[
				'adminUrl'        => admin_url( 'admin.php' ),
				'adminEmail'      => $is_admin ? sanitize_email( (string) get_option( 'admin_email', '' ) ) : null,
				'widgetColor'     => $widget['color'] ?? '#6366f1',
				'widgetPosition'  => $widget['position'] ?? 'bottom-right',
				'pluginUrl'       => Constants::url(),
				'buildUrl'        => Constants::url( 'resources/build/' ),
				'currentUserId'   => get_current_user_id(),
				'isAdmin'         => $is_admin,
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'submitNonce'     => wp_create_nonce( 'allfeedback_submit' ),
				'version'         => Constants::VERSION,
				'homeUrl'         => get_home_url(),
				'siteUrl'         => get_site_url(),
				'wpVersion'       => get_bloginfo( 'version' ),
				'isMultisite'     => is_multisite(),
				'wpMemoryLimit'   => $is_admin ? ( defined( 'WP_MEMORY_LIMIT' ) ? WP_MEMORY_LIMIT : 'N/A' ) : null,
				'debug'           => $is_admin ? ( defined( 'WP_DEBUG' ) && WP_DEBUG ) : null,
				'wpCron'          => $is_admin ? ! ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ) : null,
				'language'        => get_locale(),
				'extObjectCache'  => $is_admin ? wp_using_ext_object_cache() : null,
				'serverInfo'      => $is_admin ? ( isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : 'N/A' ) : null,
				'mysqlVersion'    => $is_admin ? $wpdb->db_version() : null,
				'phpVersion'      => $is_admin ? PHP_VERSION : null,
				'defaultTimezone' => $is_admin ? date_default_timezone_get() : null,
				'phpPostMaxSize'  => $is_admin ? ( ini_get( 'post_max_size' ) !== false ? ini_get( 'post_max_size' ) : 'N/A' ) : null,
				'phpTimeLimit'    => $is_admin ? ( ini_get( 'max_execution_time' ) !== false ? ini_get( 'max_execution_time' ) : 'N/A' ) : null,
				'curlVersion'     => $curl_str,
				'hasFsockopen'    => $is_admin ? ( function_exists( 'fsockopen' ) || function_exists( 'curl_init' ) ) : null,
				'hasGzip'         => $is_admin ? function_exists( 'gzopen' ) : null,
				'hasDomDocument'  => $is_admin ? class_exists( 'DOMDocument' ) : null,
				'hasMultibyte'    => $is_admin ? function_exists( 'mb_strtolower' ) : null,
				'wizardStatus'    => get_option( 'allfeedback_wizard_status', 'not_started' ),
			]
		);

		/**
		 * Filters extra script handles the admin app depends on.
		 *
		 * Add-ons register their script and add its handle here so it loads first
		 * and can hook into the builder with `wp.hooks.addFilter()`.
		 *
		 * @since 1.1.0
		 *
		 * @param string[] $deps Script handles.
		 */
		$admin_deps = (array) apply_filters( 'allfeedback_admin_script_dependencies', [] );

		$this->asset_manager->enqueueScript(
			handle:   'admin',
			src:      'admin.js',
			deps:     $admin_deps,
			localize: [
				'object_name' => '__ALLFB_ADMIN__',
				'data'        => $admin_data,
			]
		);

		$this->asset_manager->enqueueStyle(
			handle: 'admin',
			src:    'admin.css'
		);

		if ( is_rtl() ) {
			$this->asset_manager->enqueueStyle(
				handle: 'admin-rtl',
				src:    'admin.rtl.css'
			);
		}

		$this->doAction( 'allfeedback:admin:enqueue_assets', $hook );

		wp_add_inline_script(
			'allfb-admin',
			'(function () {
				var MENU_ROOT = "#toplevel_page_allfeedback";
				function syncHighlight() {
					var rawHash  = window.location.hash || "#/analytics";
					var hashPath = rawHash.split("?")[0];
					var current  = hashPath.replace(/\/$/, "");
					var submenu = document.querySelector(MENU_ROOT + " .wp-submenu");
					if ( ! submenu ) return;
					submenu.querySelectorAll("li").forEach(function (li) {
						var a = li.querySelector("a");
						if ( ! a ) return;
						var href         = a.getAttribute("href") || "";
						var linkHash     = href.includes("#") ? "#" + href.split("#")[1] : "";
						var linkNormised = linkHash.replace(/\/$/, "");
						if ( linkNormised && current.startsWith(linkNormised) ) {
							li.classList.add("current");
						} else {
							li.classList.remove("current");
						}
					});
				}
				syncHighlight();
				window.addEventListener("allfeedback:navigate", syncHighlight);
			})();'
		);
	}

}
