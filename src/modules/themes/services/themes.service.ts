import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Theme } from "../../../entities/Theme";
import { User } from "../../../entities/User";
import { Status } from "../../../entities/Status";
import { UpdateThemeDto } from "src/modules/themes/dto/UpdateThemeDto";
import { CreateThemeDto } from "src/modules/themes/dto/CreateThemeDto";

@Injectable()
export class ThemesService {
  constructor(
    @InjectRepository(Theme)
    private themeRepository: Repository<Theme>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
  ) {}

  async findAll() {
    const themes = await this.themeRepository.find({
      relations: ["createdBy", "updatedBy", "status"],
    });

    return themes.map((theme) => ({
      id: theme.id,
      theme_name: theme.theme_name,
      theme_abbr: theme.theme_abbr,
      status_id: theme.status_id,
      created_at: theme.created_at,
      created_by: theme.created_by,
      updated_by: theme.updated_by || null,
      modified_at: theme.modified_at,
      created_user: theme.createdBy
        ? `${theme.createdBy.first_name} ${theme.createdBy.last_name}`
        : null,
      updated_user: theme.updatedBy
        ? `${theme.updatedBy.first_name} ${theme.updatedBy.last_name}`
        : null,
      status_name: theme.status ? theme.status.status_name : null,
    }));
  }

  async findOne(id: number) {
    const theme = await this.themeRepository.findOne({
      where: { id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!theme) {
      throw new NotFoundException("Theme not found.");
    }

    return {
      id: theme.id,
      theme_name: theme.theme_name,
      theme_abbr: theme.theme_abbr,
      status_id: theme.status_id,
      created_at: theme.created_at,
      created_by: theme.created_by,
      updated_by: theme.updated_by || null,
      modified_at: theme.modified_at,
      created_user: theme.createdBy
        ? `${theme.createdBy.first_name} ${theme.createdBy.last_name}`
        : null,
      updated_user: theme.updatedBy
        ? `${theme.updatedBy.first_name} ${theme.updatedBy.last_name}`
        : null,
      status_name: theme.status ? theme.status.status_name : null,
    };
  }

  async create(createThemeDto: CreateThemeDto, userId: number) {
    const { theme_name, theme_abbr, status_id } = createThemeDto;

    // Check for duplicate theme_name
    const existingThemeByName = await this.themeRepository.findOneBy({
      theme_name,
    });
    if (existingThemeByName) {
      throw new BadRequestException("Theme with this name already exists.");
    }

    // Check for duplicate theme_abbr
    const existingThemeByAbbr = await this.themeRepository.findOneBy({
      theme_abbr,
    });
    if (existingThemeByAbbr) {
      throw new BadRequestException(
        "Theme with this abbreviation already exists.",
      );
    }

    // Find createdBy User entity
    const createdByUser = await this.userRepository.findOneBy({ id: userId });
    if (!createdByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }

    // Determine status_id: use provided status_id or default to 1 (active)
    const resolvedStatusId = status_id || 1;
    const statusEntity = await this.statusRepository.findOneBy({
      id: resolvedStatusId,
    });
    if (!statusEntity) {
      throw new BadRequestException(
        `Status with ID ${resolvedStatusId} not found.`,
      );
    }

    const theme = new Theme();
    theme.theme_name = theme_name;
    theme.theme_abbr = theme_abbr;
    theme.status = statusEntity;
    theme.status_id = statusEntity.id;
    theme.createdBy = createdByUser;
    theme.created_by = createdByUser.id;

    const savedTheme = await this.themeRepository.save(theme);

    // Fetch complete data with relations
    const newTheme = await this.themeRepository.findOne({
      where: { id: savedTheme.id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!newTheme) {
      throw new Error("Failed to retrieve created theme");
    }

    return {
      id: newTheme.id,
      theme_name: newTheme.theme_name,
      theme_abbr: newTheme.theme_abbr,
      status_id: newTheme.status_id,
      created_at: newTheme.created_at,
      created_by: newTheme.created_by,
      updated_by: newTheme.updated_by || null,
      modified_at: newTheme.modified_at,
      created_user: newTheme.createdBy
        ? `${newTheme.createdBy.first_name} ${newTheme.createdBy.last_name}`
        : null,
      updated_user: newTheme.updatedBy
        ? `${newTheme.updatedBy.first_name} ${newTheme.updatedBy.last_name}`
        : null,
      status_name: newTheme.status ? newTheme.status.status_name : null,
    };
  }

  async update(id: number, updateThemeDto: UpdateThemeDto, userId: number) {
    const { theme_name, theme_abbr, status_id } = updateThemeDto;

    const themeToUpdate = await this.themeRepository.findOne({
      where: { id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!themeToUpdate) {
      throw new NotFoundException("Theme not found for update.");
    }

    // Check for duplicate theme_name if provided and different from current
    if (theme_name && theme_name !== themeToUpdate.theme_name) {
      const existingThemeByName = await this.themeRepository
        .createQueryBuilder("theme")
        .where("theme.theme_name = :theme_name", { theme_name })
        .andWhere("theme.id != :id", { id })
        .getOne();
      if (existingThemeByName) {
        throw new BadRequestException("Theme with this name already exists.");
      }
      themeToUpdate.theme_name = theme_name;
    } else if (theme_name !== undefined) {
      themeToUpdate.theme_name = theme_name;
    }

    // Check for duplicate theme_abbr if provided and different from current
    if (theme_abbr && theme_abbr !== themeToUpdate.theme_abbr) {
      const existingThemeByAbbr = await this.themeRepository
        .createQueryBuilder("theme")
        .where("theme.theme_abbr = :theme_abbr", { theme_abbr })
        .andWhere("theme.id != :id", { id })
        .getOne();
      if (existingThemeByAbbr) {
        throw new BadRequestException(
          "Theme with this abbreviation already exists.",
        );
      }
      themeToUpdate.theme_abbr = theme_abbr;
    } else if (theme_abbr !== undefined) {
      themeToUpdate.theme_abbr = theme_abbr;
    }

    // Update status if provided
    if (status_id !== undefined) {
      const statusEntity = await this.statusRepository.findOneBy({
        id: status_id,
      });
      if (!statusEntity) {
        throw new BadRequestException(`Status with ID ${status_id} not found.`);
      }
      themeToUpdate.status = statusEntity;
      themeToUpdate.status_id = statusEntity.id;
    }

    // Set updatedBy user
    const updatedByUser = await this.userRepository.findOneBy({ id: userId });
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }
    themeToUpdate.updatedBy = updatedByUser;
    themeToUpdate.updated_by = updatedByUser.id;

    const savedTheme = await this.themeRepository.save(themeToUpdate);

    // Fetch complete data with relations
    const updatedTheme = await this.themeRepository.findOne({
      where: { id: savedTheme.id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!updatedTheme) {
      throw new Error("Failed to retrieve updated theme");
    }

    return {
      id: updatedTheme.id,
      theme_name: updatedTheme.theme_name,
      theme_abbr: updatedTheme.theme_abbr,
      status_id: updatedTheme.status_id,
      created_at: updatedTheme.created_at,
      created_by: updatedTheme.created_by,
      updated_by: updatedTheme.updated_by || null,
      modified_at: updatedTheme.modified_at,
      created_user: updatedTheme.createdBy
        ? `${updatedTheme.createdBy.first_name} ${updatedTheme.createdBy.last_name}`
        : null,
      updated_user: updatedTheme.updatedBy
        ? `${updatedTheme.updatedBy.first_name} ${updatedTheme.updatedBy.last_name}`
        : null,
      status_name: updatedTheme.status ? updatedTheme.status.status_name : null,
    };
  }

  async remove(id: number) {
    const themeToRemove = await this.themeRepository.findOneBy({ id });

    if (!themeToRemove) {
      throw new NotFoundException("Theme not found for deletion.");
    }

    await this.themeRepository.remove(themeToRemove);
    return { message: "Theme successfully deleted." };
  }

  async toggleStatus(id: number, userId: number) {
    const themeToUpdate = await this.themeRepository.findOne({
      where: { id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!themeToUpdate) {
      throw new NotFoundException("Theme not found for status toggle.");
    }

    // Determine new status_id
    let newStatusId: number;
    if (themeToUpdate.status_id === 1) {
      newStatusId = 2; // Set to inactive
    } else if (themeToUpdate.status_id === 2) {
      newStatusId = 1; // Set to active
    } else {
      newStatusId = 2; // Default to inactive
    }

    const newStatusEntity = await this.statusRepository.findOneBy({
      id: newStatusId,
    });
    if (!newStatusEntity) {
      throw new Error(
        "Target status (active/inactive) not found in the database.",
      );
    }

    themeToUpdate.status = newStatusEntity;
    themeToUpdate.status_id = newStatusEntity.id;

    // Set updatedBy user
    const updatedByUser = await this.userRepository.findOneBy({ id: userId });
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }
    themeToUpdate.updatedBy = updatedByUser;
    themeToUpdate.updated_by = updatedByUser.id;

    const updatedTheme = await this.themeRepository.save(themeToUpdate);

    const flattenedTheme = {
      id: updatedTheme.id,
      theme_name: updatedTheme.theme_name,
      theme_abbr: updatedTheme.theme_abbr,
      status_id: updatedTheme.status_id,
      created_at: updatedTheme.created_at,
      created_by: updatedTheme.created_by,
      updated_by: updatedTheme.updated_by || null,
      modified_at: updatedTheme.modified_at,
      created_user: updatedTheme.createdBy
        ? `${updatedTheme.createdBy.first_name} ${updatedTheme.createdBy.last_name}`
        : null,
      updated_user: updatedTheme.updatedBy
        ? `${updatedTheme.updatedBy.first_name} ${updatedTheme.updatedBy.last_name}`
        : null,
      status_name: updatedTheme.status ? updatedTheme.status.status_name : null,
    };

    return {
      message: `Theme ${updatedTheme.theme_name} successfully toggled to ${newStatusEntity.status_name}.`,
      theme: flattenedTheme,
    };
  }
}
