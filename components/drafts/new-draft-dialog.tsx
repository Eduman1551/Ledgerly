"use client";
// "New draft" form: title, channel, privacy tier, text (typed or from a file),
// optional image + alt text. Creating a draft also runs the first check.
import { FileUp, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { Field, NativeSelect } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client/api";
import { prepareImage } from "@/lib/client/image";
import type { Channel, Tier } from "@/lib/db/schema";

const TIER_HELP: Record<Tier, string> = {
  public: "Public: the text may be sent to AI for claim extraction and tone (confidential ledger values are still hidden).",
  internal: "Internal: names, emails, phone numbers, internal codes and confidential values are redacted before anything reaches AI.",
  confidential: "Confidential: never sent to AI. Checked on our server with local rules only.",
};

export function NewDraftDialog() {
  const router = useRouter();
  const { aiEnabled } = useApp();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<Channel>("instagram");
  const [tier, setTier] = useState<Tier>("public");
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; colors: string[] } | null>(null);
  const [imageAlt, setImageAlt] = useState("");

  async function onTextFile(file: File | undefined) {
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const { text: parsed } = await api<{ text: string }>("/api/import/parse-file", { formData: form });
      setText(parsed);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success(`Loaded text from ${file.name}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function onImageFile(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await prepareImage(file));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { draft } = await api<{ draft: { id: string } }>("/api/drafts", {
        body: { title, channel, tier, text, imageUrl: image?.dataUrl ?? null, imageAlt: imageAlt || null, imageColors: image?.colors ?? null },
      });
      // First check. If it fails the draft still exists and can be checked from its page.
      await api(`/api/drafts/${draft.id}/check`, { body: { useAi: aiEnabled } }).catch((error) => toast.error(errorMessage(error)));
      router.push(`/drafts/${draft.id}`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New draft
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New draft</DialogTitle>
            <DialogDescription>Ledgerly checks it against the Fact Ledger and brand guidelines as soon as you submit.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Title" htmlFor={`${id}-title`}>
              <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali launch post" required minLength={2} maxLength={120} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Channel" htmlFor={`${id}-channel`} hint="Hinglish and Devanagari are allowed on Instagram and ads only.">
                <NativeSelect id={`${id}-channel`} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                  <option value="instagram">Instagram</option>
                  <option value="ad">Ad</option>
                  <option value="email">Email</option>
                  <option value="document">Document</option>
                </NativeSelect>
              </Field>
              <Field label="Privacy tier" htmlFor={`${id}-tier`} hint={TIER_HELP[tier]}>
                <NativeSelect id={`${id}-tier`} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                </NativeSelect>
              </Field>
            </div>
            <Field label="Text" htmlFor={`${id}-text`} hint="English, Hindi or Hinglish. You can also load a .txt, .md or .docx file.">
              <Textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={6} required maxLength={5000} placeholder="Write or paste the post here…" />
              <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                <FileUp className="size-3.5" /> Load from file
                <input type="file" accept=".txt,.md,.docx" className="sr-only" onChange={(e) => onTextFile(e.target.files?.[0])} />
              </label>
            </Field>
            <Field label="Image (optional)" hint="Only the image's dominant colours are sent to the server, to compare with the brand palette.">
              {image ? (
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                  <img src={image.dataUrl} alt="Preview of the attached image" className="h-20 w-20 rounded-md border border-border object-cover" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center gap-1" aria-label="Dominant colours">
                      {image.colors.map((c) => (
                        <span key={c} title={c} className="size-5 rounded border border-border" style={{ backgroundColor: c }} />
                      ))}
                      <Button type="button" variant="ghost" size="xs" className="ml-auto" onClick={() => setImage(null)}>
                        <X /> Remove
                      </Button>
                    </div>
                    <Input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} placeholder="Alt text: describe the image for screen readers" maxLength={300} aria-label="Alt text" />
                  </div>
                </div>
              ) : (
                <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                  <ImagePlus className="size-3.5" /> Attach image
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImageFile(e.target.files?.[0])} />
                </label>
              )}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} {busy ? "Checking…" : "Create and check"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
