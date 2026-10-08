import { getProxies, getUrls } from "@/lib/api";
import { ProxyList } from "@/components/proxy-list";
import { UrlList } from "@/components/url-list";

export default async function Home() {
  const [proxies, urls] = await Promise.all([
    getProxies(),
    getUrls(),
  ]);

  return (
    <main className="container mx-auto space-y-10 p-6">
      <div>
        <h1 className="text-3xl font-bold">
          URL Request Sender
        </h1>

        <p className="text-muted-foreground">
          Manage URLs and proxies
        </p>
      </div>

      <UrlList initialUrls={urls} />

      <ProxyList initialProxies={proxies} />
    </main>
  );
}