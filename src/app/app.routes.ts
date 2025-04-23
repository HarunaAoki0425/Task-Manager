import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { HomeComponent } from './pages/home/home.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ProjectsComponent } from './pages/projects/projects.component';
import { ProjectListComponent } from './pages/projects/list/project-list.component';
import { ProjectDetailComponent } from './pages/projects/detail/project-detail.component';
import { ProjectEditComponent } from './pages/projects/edit/project-edit.component';
import { CreateProjectComponent } from './pages/projects/create-project/create-project.component';
import { IssueDetailComponent } from './pages/projects/detail/issue-detail/issue-detail.component';
import { IssueListComponent } from './pages/projects/detail/issue-list/issue-list.component';
import { IssueCreateComponent } from './pages/projects/detail/issue-create/issue-create.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
  {
    path: 'projects',
    component: ProjectsComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', component: ProjectListComponent },
      { path: 'create', component: CreateProjectComponent },
      { path: ':projectId', component: ProjectDetailComponent },
      { path: ':projectId/issues/create', component: IssueCreateComponent },
      { path: ':projectId/issues/:issueId', component: IssueDetailComponent }
    ]
  }
];
