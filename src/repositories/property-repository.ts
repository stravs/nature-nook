import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Property } from '../domain/property';
import { isProperty, normalizeProperty } from '../domain/property';

export interface PropertyRepository {
  get(): Promise<Property | null>;
  save(property: Property): Promise<void>;
}

export class FilePropertyRepository implements PropertyRepository {
  private readonly file = resolve(process.cwd(), process.env.PROPERTY_DATA_FILE ?? '.data/property.json');

  async get(): Promise<Property | null> {
    try {
      const value: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      return isProperty(value) ? normalizeProperty(value) : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(property: Property): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporaryFile = `${this.file}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(property, null, 2)}\n`, 'utf8');
    await rename(temporaryFile, this.file);
  }
}

export const propertyRepository: PropertyRepository = new FilePropertyRepository();
