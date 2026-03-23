import { getProjectDetail, listProjects } from "@/lib/projects/project-store";

export type ProjectListReader = typeof listProjects;
export type ProjectDetailReader = typeof getProjectDetail;

type ProjectQueryServiceDependencies = {
  list?: ProjectListReader;
  getDetail?: ProjectDetailReader;
};

export function createProjectQueryService(
  dependencies: ProjectQueryServiceDependencies = {},
) {
  const list = dependencies.list ?? listProjects;
  const getDetail = dependencies.getDetail ?? getProjectDetail;

  return {
    list,
    getDetail,
  };
}

export const projectQueryService = createProjectQueryService();
