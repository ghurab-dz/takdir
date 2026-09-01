import { SectionHeader } from "@/components/section-header";
import { ConsultationWizard } from "@/components/consultation-wizard";

export const dynamic = "force-dynamic";

export default function NewEstimatePage() {
  return (
    <div>
      <SectionHeader
        eyebrow="استشارة جديدة"
        title="استشارة بـ 3 خيارات مسعّرة ومرئية"
        hint="صور الغرفة + أبعاد + نمط + ميزانية + ملاحظاتك — سيولّد الذكاء 3 خيارات (اقتصادي / متوازن / ممتاز) كل خيار بصورته النهائية وسعره من كتالوجك فقط."
      />
      <ConsultationWizard />
    </div>
  );
}
