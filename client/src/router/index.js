import { createRouter, createWebHistory } from 'vue-router'

/**
 * Route structure mirrors the API's resource hierarchy:
 * projects (samples) → surveys (subsets) → quotas / providers / responses.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'projects', component: () => import('@/views/ProjectsView.vue') },
    { path: '/projects/:sampleId', name: 'project-detail', component: () => import('@/views/ProjectDetailView.vue'), props: true },
    { path: '/projects/:sampleId/surveys/new', name: 'survey-create', component: () => import('@/views/SurveyCreateView.vue'), props: true },
    { path: '/projects/:sampleId/surveys/:subsetId', name: 'survey-detail', component: () => import('@/views/SurveyDetailView.vue'), props: true },
    { path: '/reference', name: 'reference', component: () => import('@/views/ReferenceView.vue') },
    { path: '/guide', name: 'guide', component: () => import('@/views/GuideView.vue') },
  ],
})

export default router
