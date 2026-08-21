import PublicRequestForm from "@/components/PublicRequestForm";

export const metadata = { title: "Request form" };

export default async function PublicFormPage({ params }) {
  const { slug } = await params;
  return <PublicRequestForm slug={slug} />;
}
