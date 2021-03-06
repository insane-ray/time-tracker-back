import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Project } from './project.entity';
import { User } from '../user/user.entity';
import { CreateUpdateProjectDto } from './dto/create-update-project.dto';
import {
  ApiActionResponse,
  ApiEntityResponse,
  ApiListResponse,
} from '../../shared/helpers/api-response.helper';
import { CrudService } from '../../core/services/crud.service';
import { CrudInterface } from '../../core/interfaces/crud.interface';

@Injectable()
export class ProjectService extends CrudService<Project> implements CrudInterface<Project> {

  protected entityAlias = 'project';

  constructor(
    @InjectRepository(Project)
    repository: Repository<Project>
  ) {
    super(repository);
  }

  protected _buildQuery(user: User, uuid?: string): SelectQueryBuilder<Project> {
    const query = this.repository.createQueryBuilder(this.entityAlias);

    if (uuid) {
      query.where(`${this.entityAlias}.id = :id`, { id: uuid });
    }

    // for non-admin, return only the active project, and the project where the user is a participant
    if (!user.isAdmin) {
      query
        .leftJoin(`${this.entityAlias}.projectParticipants`, "projectParticipant")
        .andWhere(`${this.entityAlias}.isActive = :isActive`, { isActive: true })
        .andWhere(`projectParticipant.userId = :userId`, { userId: user.id });
    }

    return query
      .leftJoinAndSelect(`${this.entityAlias}.owner`, "owner");
  }

  async getAll(user: User): Promise<ApiListResponse<Project>> {
    return this.getEntityList(user);
  }

  async get(user: User, uuid: string): Promise<ApiEntityResponse<Project> | HttpException> {
    return this.getEntity(user, uuid);
  }

  async findEntity(user: User, uuid: string): Promise<Project> {
    return await (this._buildQuery(user, uuid)).getOne();
  }

  async create(project: CreateUpdateProjectDto, author: User): Promise<ApiActionResponse | HttpException> {
    return this.createEntity({...project, owner: author});
  }

  async update(project: CreateUpdateProjectDto, projectUUID: string): Promise<ApiActionResponse | HttpException> {
    return this.updateEntity(project, projectUUID);
  }

  async delete(uuid: string): Promise<ApiActionResponse | HttpException> {
    return this.updateStatus(uuid, false, 'Project', 'suspended', 'suspending');
  }

  async restore(uuid: string): Promise<ApiActionResponse | HttpException> {
    return this.updateStatus(uuid, true, 'Project',  'activated', 'activating');
  }
}
