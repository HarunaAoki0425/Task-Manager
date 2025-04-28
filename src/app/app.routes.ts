import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { DefaultLayoutComponent } from './layouts/default-layout/default-layout.component';
import { ProjectListComponent } from './pages/project/project-list/project-list.component';
import { ProjectCreateComponent } from './pages/project/project-create/project-create.component';
import { SettingComponent } from './pages/setting/setting.component';
import { ProjectDetailComponent } from './pages/project/project-detail/project-detail.component';
import { ArchiveComponent } from './pages/archive/archive.component';
import { IssueCreateComponent } from './pages/issue/issue-create.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: '',
    component: DefaultLayoutComponent,
    children: [
      {
        path: 'home',
        component: HomeComponent
      },
      {
        path: 'project-list',
        component: ProjectListComponent
      },
      {
        path: 'project/project-create',
        component: ProjectCreateComponent
      },
      {
        path: 'setting',
        component: SettingComponent
      },
      {
        path: 'project/:id',
        component: ProjectDetailComponent
      },
      {
        path: 'archive',
        component: ArchiveComponent
      },
      {
        path: 'issue-create',
        component: IssueCreateComponent
      },
      {
        path: 'project-invite/:projectId/:inviteId',
        loadComponent: () => import('./pages/project/project-invite/project-invite.component').then(m => m.ProjectInviteComponent)
      }
    ]
  }
]; 