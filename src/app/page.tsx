import { Suspense } from "react";

import { getProxies, getUrls } from "@/lib/api";

import { ProxyList } from "@/components/proxy-list";
import { UrlList } from "@/components/url-list";
import { RequestPanel } from "@/components/request-panel";

async function HomeContent() {
  const [proxies, urls] = await Promise.all([
    getProxies(),
    getUrls(),
  ]);

  return (
    <>
      <RequestPanel
        urls={urls}
        proxies={proxies}
      />

      <UrlList initialUrls={urls} />

      <ProxyList initialProxies={proxies} />
    </>
  );
}

export default function Home() {
  return (
    <main className="container mx-auto space-y-10 p-6">
      <div>
        <h1 className="text-3xl font-bold">
          URL Request Sender
        </h1>

        <p className="text-muted-foreground">
          Manage URLs, proxies and requests
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-lg border p-6">
            Loading...
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </main>
  );
}