import { Pipe, PipeTransform } from '@angular/core';
import { Issue } from '../../models/project.model';

@Pipe({
  name: 'filterByStatus',
  standalone: true
})
export class FilterByStatusPipe implements PipeTransform {
  transform(items: Issue[], status: 'not_started' | 'in_progress' | 'completed'): Issue[] {
    if (!items) return [];
    return items.filter(item => item.status === status);
  }
} 