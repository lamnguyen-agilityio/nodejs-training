export interface CreateCategory {
  name: string;
  image: string;
  description?: string;
}

export type UpdateCategory = Partial<CreateCategory>;
