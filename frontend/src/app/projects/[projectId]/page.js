import ProtectedModule from "../../../components/ProtectedModule";

export default async function ProjectDetailPage({ params }) {
  const { projectId } = await params;
  return <ProtectedModule moduleId="projects" projectId={projectId} />;
}
