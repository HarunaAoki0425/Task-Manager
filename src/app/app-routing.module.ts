import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/projects',
    pathMatch: 'full'
  },
  {
    path: 'projects',
    loadComponent: () => import('./pages/project/project-list/project-list.component').then(m => m.ProjectListComponent)
  },
  {
    path: 'projects/:id',
    loadComponent: () => import('./pages/project/project-detail/project-detail.component').then(m => m.ProjectDetailComponent)
  },
  {
    path: 'projects/:projectId/issues/create',
    loadComponent: () => import('./pages/issue/issue-create/issue-create.component').then(m => m.IssueCreateComponent)
  },
  {
    path: 'projects/:projectId/issues/:issueId',
    loadComponent: () => import('./pages/issue/issue-detail/issue-detail.component').then(m => m.IssueDetailComponent)
  },
  {
    path: 'calendar',
    loadComponent: () => import('./pages/calendar/calendar/calendar.component').then(m => m.CalendarComponent)
  },
  {
    path: 'calendar/:year/:month',
    loadComponent: () => import('./pages/calendar/calendar/calendar.component').then(m => m.CalendarComponent)
  },
  {
    path: 'archive',
    loadComponent: () => import('./pages/archive/archive/archive.component').then(m => m.ArchiveComponent)
  },
  {
    path: 'archives/:archiveId',
    loadComponent: () => import('./pages/archive/archive-detail/archive-detail.component').then(m => m.ArchiveDetailComponent)
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { } 