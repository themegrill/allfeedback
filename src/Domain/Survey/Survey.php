<?php
/**
 * Survey.
 *
 * @package AllFeedback\Domain\Survey
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\Domain\Survey;

defined( 'ABSPATH' ) || exit;

use AllFeedback\Domain\Shared\Entity;
use DateTimeImmutable;

/**
 * Survey aggregate root.
 *
 * Represents a single NPS survey definition including its form
 * schema, display settings, targeting rules, lifecycle status, and aggregate
 * response count.
 *
 * @package AllFeedback\Domain\Survey
 * @since   1.0.0
 */
class Survey extends Entity {

	/**
	 * Current lifecycle status of the survey.
	 *
	 * @var SurveyStatus
	 * @since 1.0.0
	 */
	private SurveyStatus $status;

	/**
	 * Human-readable explanation of a targeting conflict, or null when none.
	 *
	 * @var string|null
	 * @since 1.0.0
	 */
	private ?string $conflict_reason = null;

	/**
	 * Denormalised count of submitted responses for this survey.
	 *
	 * @var int
	 * @since 1.0.0
	 */
	private int $response_count;

	/**
	 * Timestamp of when the survey was first persisted.
	 *
	 * @var DateTimeImmutable
	 * @since 1.0.0
	 */
	private DateTimeImmutable $created_at;

	/**
	 * Timestamp of the most recent update, or null when unmodified since creation.
	 *
	 * @var DateTimeImmutable|null
	 * @since 1.0.0
	 */
	private ?DateTimeImmutable $updated_at = null;

	/**
	 * Targeting rules controlling where/when the survey is displayed.
	 *
	 * @var array<mixed>
	 * @since 1.0.0
	 */
	private array $targeting;

	/**
	 * Constructor.
	 *
	 * @param  string                 $title         Human-readable survey title.
	 * @param  string                 $description   Optional survey description.
	 * @param  array<mixed>           $form_schema    Structured form field definitions.
	 * @param  array<mixed>           $settings      Survey display and behaviour settings.
	 * @param  array<mixed>           $styling       Visual customisation overrides.
	 * @param  array<mixed>           $targeting     Targeting rules.
	 * @param  int                    $created_by     WordPress user ID of the author.
	 * @param  SurveyStatus|null      $status        Initial status; defaults to Draft.
	 * @param  int                    $response_count Seed value for the response counter.
	 * @param  DateTimeImmutable|null $created_at     Optional creation timestamp; defaults to now.
	 * @since  1.0.0
	 */
	public function __construct(
		private string $title,
		private string $description = '',
		private array $form_schema = [],
		private array $settings = [],
		private array $styling = [],
		array $targeting = [],
		private int $created_by = 0,
		?SurveyStatus $status = null,
		int $response_count = 0,
		?DateTimeImmutable $created_at = null,
	) {
		$this->targeting      = $targeting;
		$this->status         = $status ?? SurveyStatus::Draft;
		$this->response_count = $response_count;
		$this->created_at     = $created_at ?? new DateTimeImmutable();
	}

	/**
	 * Reconstitute a Survey from a persistence row.
	 *
	 * @param  int                    $id             Primary key.
	 * @param  string                 $title          Survey title.
	 * @param  string                 $description    Survey description.
	 * @param  array<mixed>           $form_schema     Decoded form schema.
	 * @param  array<mixed>           $settings       Decoded settings.
	 * @param  SurveyStatus           $status         Current status.
	 * @param  int                    $response_count  Denormalised response count.
	 * @param  int                    $created_by      Author user ID.
	 * @param  DateTimeImmutable      $created_at      Creation timestamp.
	 * @param  DateTimeImmutable|null $updated_at      Last-updated timestamp.
	 * @param  array<mixed>           $styling        Styling overrides.
	 * @param  string|null            $conflict_reason Targeting conflict explanation.
	 * @param  array<mixed>           $targeting       Targeting rules.
	 * @return self
	 * @since  1.0.0
	 */
	public static function reconstitute(
		int $id,
		string $title,
		string $description,
		array $form_schema,
		array $settings,
		SurveyStatus $status,
		int $response_count,
		int $created_by,
		DateTimeImmutable $created_at,
		?DateTimeImmutable $updated_at = null,
		array $styling = [],
		?string $conflict_reason = null,
		array $targeting = [],
	): self {
		$survey                  = new self( $title, $description, $form_schema, $settings, $styling, $targeting, $created_by, $status, $response_count, $created_at );
		$survey->id              = $id;
		$survey->updated_at      = $updated_at;
		$survey->conflict_reason = $conflict_reason;
		return $survey;
	}

	/**
	 * Return the survey title.
	 *
	 * @return string
	 * @since  1.0.0
	 */
	public function getTitle(): string {
		return $this->title;
	}

	/**
	 * Update the survey title and record a modification timestamp.
	 *
	 * @param  string $title New title.
	 * @return void
	 * @since  1.0.0
	 */
	public function setTitle( string $title ): void {
		$this->title = $title;
		$this->touch();
	}

	/**
	 * Return the survey description.
	 *
	 * @return string
	 * @since  1.0.0
	 */
	public function getDescription(): string {
		return $this->description;
	}

	/**
	 * Update the survey description and record a modification timestamp.
	 *
	 * @param  string $description New description.
	 * @return void
	 * @since  1.0.0
	 */
	public function setDescription( string $description ): void {
		$this->description = $description;
		$this->touch();
	}

	/**
	 * Return the raw form schema array.
	 *
	 * @return array<mixed>
	 * @since  1.0.0
	 */
	public function getFormSchema(): array {
		return $this->form_schema;
	}

	/**
	 * Add-on features this form needs, as saved by the builder in `form_schema.requires`.
	 *
	 * @return string[]
	 * @since  1.1.0
	 */
	public function getRequiredFeatures(): array {
		$requires = (array) ( $this->form_schema['requires'] ?? [] );
		return array_values( array_filter( array_map( 'strval', $requires ) ) );
	}

	/**
	 * Required add-on features that are not active right now (e.g. Pro was deactivated).
	 *
	 * @return string[]
	 * @since  1.1.0
	 */
	public function getMissingFeatures(): array {
		/**
		 * Filters the add-on features that are currently active.
		 *
		 * Add-ons add their feature ids here, e.g. AllFeedback Pro adds 'conditional-logic'.
		 * A form that requires a feature missing from this list is taken offline.
		 *
		 * @since 1.1.0
		 *
		 * @param string[] $features Active feature ids.
		 */
		$active = array_map( 'strval', (array) apply_filters( 'allfeedback_active_features', [] ) );

		return array_values( array_diff( $this->getRequiredFeatures(), $active ) );
	}

	/**
	 * Whether visitors can see and submit this form: published and every required feature active.
	 *
	 * @return bool
	 * @since  1.1.0
	 */
	public function isLive(): bool {
		return $this->getStatus()->isPublished() && [] === $this->getMissingFeatures();
	}

	/**
	 * Replace the form schema and record a modification timestamp.
	 *
	 * @param  array<mixed> $form_schema New form schema.
	 * @return void
	 * @since  1.0.0
	 */
	public function setFormSchema( array $form_schema ): void {
		$this->form_schema = $form_schema;
		$this->touch();
	}

	/**
	 * Return the display and behaviour settings array.
	 *
	 * @return array<mixed>
	 * @since  1.0.0
	 */
	public function getSettings(): array {
		return $this->settings;
	}

	/**
	 * Replace the settings array and record a modification timestamp.
	 *
	 * @param  array<mixed> $settings New settings.
	 * @return void
	 * @since  1.0.0
	 */
	public function setSettings( array $settings ): void {
		$this->settings = $settings;
		$this->touch();
	}

	/**
	 * Return the visual styling overrides array.
	 *
	 * @return array<mixed>
	 * @since  1.0.0
	 */
	public function getStyling(): array {
		return $this->styling;
	}

	/**
	 * Replace the styling array and record a modification timestamp.
	 *
	 * @param  array<mixed> $styling New styling overrides.
	 * @return void
	 * @since  1.0.0
	 */
	public function setStyling( array $styling ): void {
		$this->styling = $styling;
		$this->touch();
	}

	/**
	 * Return the targeting rules array.
	 *
	 * @return array<mixed>
	 * @since  1.0.0
	 */
	public function getTargeting(): array {
		return $this->targeting;
	}

	/**
	 * Replace the targeting rules and record a modification timestamp.
	 *
	 * @param  array<mixed> $targeting New targeting rules.
	 * @return void
	 * @since  1.0.0
	 */
	public function setTargeting( array $targeting ): void {
		$this->targeting = $targeting;
		$this->touch();
	}

	/**
	 * Return the current lifecycle status.
	 *
	 * @return SurveyStatus
	 * @since  1.0.0
	 */
	public function getStatus(): SurveyStatus {
		return $this->status;
	}

	/**
	 * Transition the survey to the given status by string value.
	 *
	 * @param  string $status Status string matching a SurveyStatus case value.
	 * @return void
	 * @since  1.0.0
	 */
	public function setStatus( string $status ): void {
		$this->status = SurveyStatus::from( $status );
		$this->touch();
	}

	/**
	 * Return the targeting conflict reason string, or null when absent.
	 *
	 * @return string|null
	 * @since  1.0.0
	 */
	public function getConflictReason(): ?string {
		return $this->conflict_reason;
	}

	/**
	 * Set or clear the targeting conflict reason.
	 *
	 * @param  string|null $reason Conflict explanation, or null to clear.
	 * @return void
	 * @since  1.0.0
	 */
	public function setConflictReason( ?string $reason ): void {
		$this->conflict_reason = $reason;
	}

	/**
	 * Return the denormalised response count.
	 *
	 * @return int
	 * @since  1.0.0
	 */
	public function getResponseCount(): int {
		return $this->response_count;
	}

	/**
	 * Return the WordPress user ID of the survey author.
	 *
	 * @return int
	 * @since  1.0.0
	 */
	public function getCreatedBy(): int {
		return $this->created_by;
	}

	/**
	 * Return the survey creation timestamp.
	 *
	 * @return DateTimeImmutable
	 * @since  1.0.0
	 */
	public function getCreatedAt(): DateTimeImmutable {
		return $this->created_at;
	}

	/**
	 * Return the last-updated timestamp, or null when never modified.
	 *
	 * @return DateTimeImmutable|null
	 * @since  1.0.0
	 */
	public function getUpdatedAt(): ?DateTimeImmutable {
		return $this->updated_at;
	}

	/**
	 * Transition the survey to Published status so it is publicly visible.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function publish(): void {
		$this->status = SurveyStatus::Published;
		$this->touch();
	}

	/**
	 * Transition the survey to Archived status, hiding it from public view.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function archive(): void {
		$this->status = SurveyStatus::Archived;
		$this->touch();
	}

	/**
	 * Move the survey to the Trashed status (soft delete).
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function trash(): void {
		$this->status = SurveyStatus::Trashed;
		$this->touch();
	}

	/**
	 * Restore a trashed survey back to Draft.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function restore(): void {
		$this->status = SurveyStatus::Draft;
		$this->touch();
	}

	/**
	 * Increment the denormalised response counter by one.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	public function incrementResponseCount(): void {
		++$this->response_count;
		$this->touch();
	}

	/**
	 * Serialise the aggregate to a plain associative array for persistence.
	 *
	 * @return array<string, mixed>
	 * @since  1.0.0
	 */
	public function toArray(): array {
		return [
			'id'             => $this->id,
			'title'          => $this->title,
			'description'    => $this->description,
			'form_schema'    => $this->form_schema,
			'settings'       => $this->settings,
			'styling'        => $this->styling,
			'targeting'      => $this->targeting,
			'status'         => $this->status->value,
			'response_count' => $this->response_count,
			'created_by'     => $this->created_by,
			'created_at'     => $this->created_at->format( 'Y-m-d H:i:s' ),
			'updated_at'     => $this->updated_at?->format( 'Y-m-d H:i:s' ),
		];
	}

	/**
	 * Update the last-modified timestamp to now.
	 *
	 * @return void
	 * @since  1.0.0
	 */
	private function touch(): void {
		$this->updated_at = new DateTimeImmutable();
	}
}
