import { AppPage } from "@/components/ui/app-page";
import { SkillsScreen } from "@/components/skills/skills-screen";

export default function SkillsPage() {
  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <SkillsScreen />
    </AppPage>
  );
}
