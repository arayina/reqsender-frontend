"use client";

import { FormEvent, useState } from "react";

import {
  createUrl,
  updateUrl,
  type TargetUrl,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  urlItem?: TargetUrl;
  onSaved: (url: TargetUrl) => void;
  onCancel: () => void;
};

export function UrlForm({
  urlItem,
  onSaved,
  onCancel,
}: Props) {
  const isEdit = Boolean(urlItem);

  const [url, setUrl] = useState(urlItem?.url ?? "");
  const [name, setName] = useState(urlItem?.name ?? "");
  const [enabled, setEnabled] = useState(urlItem?.enabled ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      let savedUrl: TargetUrl;

      if (isEdit && urlItem) {
        savedUrl = await updateUrl(urlItem.id, {
          url,
          name: name || undefined,
          enabled,
        });
      } else {
        savedUrl = await createUrl({
          url,
          name: name || undefined,
          enabled,
        });
      }

      onSaved(savedUrl);
    } catch {
      setError(
        isEdit
          ? "Failed to update URL"
          : "Failed to create URL",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>

        <Input
          id="url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>

        <Input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example Website"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Enabled
      </label>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={loading}>
          {loading
            ? "Saving..."
            : isEdit
              ? "Save Changes"
              : "Add URL"}
        </Button>
      </div>
    </form>
  );
}