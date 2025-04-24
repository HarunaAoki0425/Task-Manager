import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Todo } from '../../../../models/project.model';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface ProjectMember {
  uid: string;
  displayName: string;
}

@Component({
  selector: 'app-todo-create',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './todo-create.component.html',
  styleUrl: './todo-create.component.css'
})
export class TodoCreateComponent {
  @Input() todos: Todo[] = [];
  @Input() projectMembers: ProjectMember[] = [];
  @Output() todosChange = new EventEmitter<Todo[]>();
  minDate: string;
  newTodo: Todo = {
    id: '',
    title: '',
    completed: false,
    assignedTo: '',
    dueDate: undefined
  };
  @Output() todoCreated = new EventEmitter<Todo>();

  constructor() {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
  }

  addTodo() {
    const newTodo: Todo = {
      id: Date.now().toString(), // 仮のID生成
      title: '',
      completed: false,
      assignedTo: '', // 初期値は未割り当て
      dueDate: undefined
    };
    this.todos.push(newTodo);
    this.todosChange.emit(this.todos);
  }

  removeTodo(index: number) {
    this.todos.splice(index, 1);
    this.todosChange.emit(this.todos);
  }

  async createTodo(): Promise<void> {
    if (!this.newTodo.title.trim()) return;

    try {
      const todo: Todo = {
        id: crypto.randomUUID(),
        title: this.newTodo.title,
        completed: false,
        assignedTo: this.newTodo.assignedTo,
        dueDate: this.newTodo.dueDate
      };

      // TODO: Implement todo creation logic
      console.log('New todo:', todo);
      
      this.todoCreated.emit(todo);
      this.resetForm();
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  }

  resetForm() {
    this.newTodo = {
      id: '',
      title: '',
      completed: false,
      assignedTo: '',
      dueDate: undefined
    };
  }
}
