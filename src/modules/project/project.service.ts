import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { ApiResponseHelper } from '../../shared/helpers/api-response.helper';

@Injectable()
export class ProjectService {

  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>
  ) {}

  private _buildProjectQuery(uuid: string | null = null, user: User | null = null): SelectQueryBuilder<Project> {
    const query = this.projectRepository.createQueryBuilder('project');

    if (uuid) {
      query.where("project.id = :id", { id: uuid });
    }

    // for non-admin, return only the active project, and the project where the user is a participant
    if (!user.isAdmin) {
      query
        .leftJoin("project.projectParticipants", "projectParticipant")
        .andWhere("project.isActive = :isActive", { isActive: true })
        .andWhere("projectParticipant.userId = :userId", { userId: user.id });
    }

    return query
      .leftJoinAndMapOne("project.owner", "project.owner", "owner");
  }

  async getAll(user: User): Promise<ApiListResponse<Project>> {
    const query = this._buildProjectQuery(null, user);

    const result = await query
      .orderBy('project.created', 'DESC')
      .getMany();
    return ApiResponseHelper.list(result);
  }

  async get(user: User, uuid: string): Promise<ApiEntityResponse<Project> | HttpException> {
    const entity = await (this._buildProjectQuery(uuid, user)).getOne();

    if (!entity) {
      throw new HttpException("Project not found", HttpStatus.NOT_FOUND)
    }

    return ApiResponseHelper.entity(entity);
  }

  async findEntity(uuid: string, user: User): Promise<Project> {
    return await (this._buildProjectQuery(uuid, user)).getOne();
  }

  async create(project: CreateUpdateProjectDto, author: User): Promise<ApiActionResponse | HttpException> {
    try {
      const entity = await this.projectRepository.insert({...project, owner: author});
      return ApiResponseHelper.successAction('Project successfully created', entity);
    } catch (err) {
      throw new HttpException("An error occurred while creating project", HttpStatus.BAD_REQUEST)
    }
  }

  async update(project: CreateUpdateProjectDto, projectUuid: string): Promise<ApiActionResponse | HttpException> {
    try {
      const entity = await this.projectRepository.update(projectUuid, project);
      return ApiResponseHelper.successAction('Project successfully updated', entity);
    } catch (err) {
      throw new HttpException("An error occurred while updating project", HttpStatus.BAD_REQUEST)
    }
  }

  private async _updateStatus(
    uuid: string,
    newStatus: boolean,
    completedText: string,
    progressingText: string,
  ): Promise<ApiActionResponse | HttpException> {
    const entity: Project = await this.projectRepository.findOne({
      where: {
        id: uuid,
        isActive: !newStatus
      }});

    if (!entity) {
      throw new HttpException("Invalid request", HttpStatus.BAD_REQUEST)
    }

    try {
      entity.isActive = newStatus;
      const result = await this.projectRepository.update(uuid, entity);
      return ApiResponseHelper.successAction(`Project successfully ${completedText}`, result);
    } catch (err) {
      throw new HttpException(`An error occurred while ${progressingText} project`, HttpStatus.BAD_REQUEST)
    }
  }

  async suspend(uuid: string): Promise<ApiActionResponse | HttpException> {
    return this._updateStatus(uuid, false, 'suspended', 'suspending');
  }

  async activate(uuid: string): Promise<ApiActionResponse | HttpException> {
    return this._updateStatus(uuid, true, 'activated', 'activating');
  }
}
