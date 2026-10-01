import { bootstrap } from "@/server/db/repository";
import { Workbench } from "@/features/workbench/workbench";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; task?: string }>;
}) {
  const params = await searchParams;
  const data = await bootstrap(params.workspace);
  return (
    <Workbench
      key={data.activeWorkspace}
      initial={data}
      initialTask={params.task}
    />
  );
}
