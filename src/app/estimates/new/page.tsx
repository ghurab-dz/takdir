import { SectionHeader } from "@/components/section-header";
import { NewEstimateForm } from "@/components/new-estimate-form";

export const dynamic = "force-dynamic";

export default function NewEstimatePage() {
  return (
    <div>
      <SectionHeader
        eyebrow="تقدير جديد"
        title="صوّر الغرفة وصِف العمل"
        hint="ارفع حتى 4 صور للغرفة واكتب وصفًا قصيرًا. سيستخرج التطبيق البنود والكميات من قائمة أسعارك فقط — ثم تراجع كل شيء قبل الاعتماد."
      />
      <NewEstimateForm />
    </div>
  );
}
