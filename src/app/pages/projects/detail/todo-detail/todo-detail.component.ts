import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from '../../../../models/project.model';

interface ProjectMember {
  uid: string;
  displayName: string;
}

@Component({
  selector: 'app-todo-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './todo-detail.component.html',
  styleUrls: ['./todo-detail.component.css']
})
export class TodoDetailComponent {
  @Input() todos: Todo[] = [];
  @Input() projectMembers: ProjectMember[] = [];
  @Output() todosChange = new EventEmitter<Todo[]>();

  getCompletedTodos(): number {
    return this.todos.filter(todo => todo.completed).length;
  }

  getTodoProgress(): number {
    if (this.todos.length === 0) return 0;
    return (this.getCompletedTodos() / this.todos.length) * 100;
  }

  toggleTodoStatus(todo: Todo) {
    todo.completed = !todo.completed;
    this.todosChange.emit(this.todos);
  }

  onTodoChange() {
    this.todosChange.emit(this.todos);
  }

  getMemberName(uid: string): string {
    const member = this.projectMembers.find(m => m.uid === uid);
    return member?.displayName || '未割り当て';
  }
}
