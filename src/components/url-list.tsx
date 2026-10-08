"use client";

import { useState } from "react";

import {
  deleteUrl,
  updateUrl,
  type TargetUrl,
} from "@/lib/api";

import { UrlForm } from "@/components/url-form";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

type Props = {
  initialUrls: TargetUrl[];
};

export function UrlList({ initialUrls }: Props) {
  const [urls, setUrls] = useState(initialUrls);
  const [editingUrl, setEditingUrl] = useState<TargetUrl | null>(null);

  async function handleDelete(id: string) {
    await deleteUrl(id);

    setUrls((current) =>
      current.filter((item) => item.id !== id),
    );
  }

  async function handleToggle(urlItem: TargetUrl) {
    const updated = await updateUrl(urlItem.id, {
      enabled: !urlItem.enabled,
    });

    setUrls((current) =>
      current.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          URLs
        </h2>

        <Button onClick={() => setEditingUrl({} as TargetUrl)}>
          Add URL
        </Button>
      </div>

      <div className="space-y-3">
        {urls.length === 0 ? (
          <p className="text-muted-foreground">
            No URLs found.
          </p>
        ) : (
          urls.map((urlItem) => (
            <div
              key={urlItem.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {urlItem.name || "Unnamed URL"}
                </p>

                <p className="truncate text-sm text-muted-foreground">
                  {urlItem.url}
                </p>

                <p className="mt-1 text-xs">
                  {urlItem.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>

              <div className="ml-4 flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingUrl(urlItem)}
                >
                  Edit
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggle(urlItem)}
                >
                  {urlItem.enabled ? "Disable" : "Enable"}
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(urlItem.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={Boolean(editingUrl)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUrl(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingUrl?.id ? "Edit URL" : "Add URL"}
            </DialogTitle>
          </DialogHeader>

          {editingUrl && (
            <UrlForm
              urlItem={editingUrl.id ? editingUrl : undefined}
              onSaved={(savedUrl) => {
                setUrls((current) => {
                  const exists = current.some(
                    (item) => item.id === savedUrl.id,
                  );

                  if (exists) {
                    return current.map((item) =>
                      item.id === savedUrl.id
                        ? savedUrl
                        : item,
                    );
                  }

                  return [savedUrl, ...current];
                });

                setEditingUrl(null);
              }}
              onCancel={() => setEditingUrl(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}