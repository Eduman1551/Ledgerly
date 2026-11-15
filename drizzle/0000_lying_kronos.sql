CREATE TABLE "brand_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tier" text DEFAULT 'public' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"language" text NOT NULL,
	"ai_path" text NOT NULL,
	"model" text,
	"chars_sent_to_ai" integer DEFAULT 0 NOT NULL,
	"redactions_count" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text,
	"issue_id" text,
	"rule_version_id" text,
	"fact_id" text,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"channel" text NOT NULL,
	"tier" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fact_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"fact_id" text NOT NULL,
	"version_no" integer NOT NULL,
	"value" text NOT NULL,
	"display_value" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"effective_from" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"value_type" text NOT NULL,
	"unit" text,
	"tier" text DEFAULT 'public' NOT NULL,
	"owner" text NOT NULL,
	"current_version_id" text,
	CONSTRAINT "facts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "guideline_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"insight" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposed_body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" text PRIMARY KEY NOT NULL,
	"check_run_id" text NOT NULL,
	"kind" text NOT NULL,
	"claim_status" text,
	"span_start" integer NOT NULL,
	"span_end" integer NOT NULL,
	"excerpt" text NOT NULL,
	"explanation" text NOT NULL,
	"fact_version_id" text,
	"rule_version_id" text,
	"suggestion" text NOT NULL,
	"replacement" text,
	"severity" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"revision_no" integer NOT NULL,
	"text" text NOT NULL,
	"image_url" text,
	"image_alt" text,
	"image_colors" jsonb,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"version_no" integer NOT NULL,
	"body" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_note" text
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"tier" text DEFAULT 'public' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"current_version_id" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_runs" ADD CONSTRAINT "check_runs_revision_id_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_versions" ADD CONSTRAINT "fact_versions_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guideline_suggestions" ADD CONSTRAINT "guideline_suggestions_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_check_run_id_check_runs_id_fk" FOREIGN KEY ("check_run_id") REFERENCES "public"."check_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;