import { getProxies } from "@/lib/api";
import { ProxyList } from "@/components/proxy-list";

export default async function Home() {
  const proxies = await getProxies();

  return (
    <main className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Proxy Manager</h1>
        <p className="text-muted-foreground">
          Manage your proxy servers
        </p>
      </div>

      <ProxyList initialProxies={proxies} />
    </main>
  );
}