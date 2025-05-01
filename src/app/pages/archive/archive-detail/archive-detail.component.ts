import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Project } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-archive-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './archive-detail.component.html',
  styleUrls: ['./archive-detail.component.css']
})
export class ArchiveDetailComponent implements OnInit {
  project: Project | null = null;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('id');
    if (projectId) {
      this.loadProject(projectId);
    }
  }

  private async loadProject(projectId: string) {
    try {
      this.project = await this.projectService.getArchivedProject(projectId);
    } catch (error) {
      console.error('Error loading archived project:', error);
    }
  }

  formatDate(timestamp: Timestamp | undefined): string {
    if (!timestamp) return '日付なし';
    return new DatePipe('ja-JP').transform(timestamp.toDate(), 'yyyy/MM/dd') || '日付なし';
  }
}
