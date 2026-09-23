import ProtectedModule from "../../../components/ProtectedModule";

export default async function DepartmentFolderPage({ params }) {
  const { departmentId } = await params;
  return <ProtectedModule moduleId="department-documents" departmentId={departmentId} />;
}
