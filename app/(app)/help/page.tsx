import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";
import { BrandCredit } from "@/components/brand-credit";

export default async function HelpPage() {
  const { m } = await getI18n();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.help.title}</h1>
      <div className="space-y-4">
        {m.help.faqs.map((faq) => (
          <Card key={faq.q}>
            <CardHeader>
              <CardTitle className="text-base">{faq.q}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{faq.a}</CardContent>
          </Card>
        ))}
      </div>
      <BrandCredit className="text-center" />
    </div>
  );
}
