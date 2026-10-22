import { getCurrentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { getTree } from "@/server/playbook";
import { FullstackShell } from "./components/FullstackShell";
import { ModuleRouter } from "./components/ModuleRouter";
import { HomeModule } from "./components/HomeModule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [user, tree] = await Promise.all([getCurrentUser(), getTree("PKT_FRONT_LEV1")]);

  if (!user) redirect("/login");

  return <FullstackShell user={user}><ModuleRouter tree={tree}><HomeModule userName={user.username} email={user.email} /></ModuleRouter></FullstackShell>;
}
