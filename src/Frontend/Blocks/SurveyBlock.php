<?php
/**
 * Survey block.
 *
 * @package AllFeedback\Frontend\Blocks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\Frontend\Blocks;

defined( 'ABSPATH' ) || exit;

use AllFeedback\API\Controllers\V1\SubmitController;
use AllFeedback\Core\Container;
use AllFeedback\Core\Settings\SettingsManager;
use AllFeedback\Domain\Survey\SurveyRepository;

/**
 * The allfeedback/survey Gutenberg block.
 *
 * Render callback: returns a lightweight mount-point div.
 * The frontend.js widget hydrates it at runtime with the interactive form.
 *
 * Editor preview: the React editor script (block-survey.js) fetches the
 * survey via apiFetch and renders a static preview using surveyPreviewHtml()
 * from resources/scripts/shared/formPreview.ts — no PHP form rendering needed.
 *
 * The accent colour is injected via wp_add_inline_script so the preview
 * matches the live widget colour without an extra REST request.
 *
 * @package AllFeedback\Frontend\Blocks
 * @since   1.0.0
 */
class SurveyBlock extends AbstractBlock {

	/**
	 * Constructor.
	 *
	 * @param  Container       $container       DI container for lazy repository resolution.
	 * @param  SettingsManager $settings_manager Plugin settings for widget colour injection.
	 * @since  1.0.0
	 */
	public function __construct(
		private readonly Container $container,
		private readonly SettingsManager $settings_manager,
	) {}

	/**
	 * Return the block folder slug.
	 *
	 * @return string
	 * @since  1.0.0
	 */
	protected function getSlug(): string {
		return 'survey';
	}

	/**
	 * Inject plugin settings into the block editor script after registration.
	 *
	 * The window.__ALLFB_BLOCK__ global is read by the React editor component to apply
	 * the correct accent colour to the form preview.
	 *
	 * @param  \WP_Block_Type $block_type Registered block type object.
	 * @return void
	 * @since  1.0.0
	 */
	protected function afterRegister( \WP_Block_Type $block_type ): void {
		if ( empty( $block_type->editor_script_handles ) ) {
			return;
		}

		$widget_settings = (array) $this->settings_manager->get( 'general.widget' );

		wp_add_inline_script(
			$block_type->editor_script_handles[0],
			'window.__ALLFB_BLOCK__ = ' . wp_json_encode(
				[
					'color' => $widget_settings['color'] ?? '#6366f1',
				]
			) . ';',
			'before'
		);
	}

	/**
	 * Render a lightweight mount-point div for the JS widget to hydrate.
	 *
	 * Only published surveys are rendered on the frontend. The block editor
	 * canvas handles its own preview entirely in TypeScript (no PHP form HTML).
	 *
	 * @param  array<string, mixed> $attributes Block attributes.
	 * @return string HTML or empty string.
	 * @since  1.0.0
	 */
	public function render( array $attributes ): string {
		$survey_id = (int) ( $attributes['surveyId'] ?? 0 );

		if ( $survey_id <= 0 ) {
			return '';
		}

		/** @var SurveyRepository $repo */ // phpcs:ignore Generic.Commenting.DocComment.MissingShort -- inline type hint		$repo   = $this->container->get( SurveyRepository::class );
		$survey = $repo->findById( $survey_id );

		if ( $survey === null || ! $survey->isLive() ) {
			return '';
		}

		$nonce = esc_attr( wp_create_nonce( SubmitController::NONCE_ACTION ) );

		return sprintf(
			'<div class="allfb-embed" data-survey-id="%d" data-nonce="%s" role="region" aria-label="%s"></div>',
			$survey_id,
			$nonce,
			esc_attr( $survey->getTitle() )
		);
	}
}
