import { SectionHeader } from "@/components/section-header";
import { ConsultationWizard } from "@/components/consultation-wizard";

export const dynamic = "force-dynamic";

export default function NewEstimatePage() {
  return (
    <div>
      <SectionHeader
        eyebrow="تصميم جديد"
        title="صورة + وصف = تصميم وسعر"
        hint="أضف صور الغرفة وقل ماذا تريد (صوت أو كتابة) — نولّد لك تصميمًا واحدًا واقعيًا وسعره من كتالوج شركتك فقط."
      />
      <ConsultationWizard />
    </div>
  );
}
