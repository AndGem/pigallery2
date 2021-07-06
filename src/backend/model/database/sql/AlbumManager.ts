import {SQLConnection} from './SQLConnection';
import {AlbumBaseEntity} from './enitites/album/AlbumBaseEntity';
import {AlbumBaseDTO} from '../../../../common/entities/album/AlbumBaseDTO';
import {SavedSearchDTO} from '../../../../common/entities/album/SavedSearchDTO';
import {ObjectManagers} from '../../ObjectManagers';
import {ISQLSearchManager} from './ISearchManager';
import {SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';
import {SavedSearchEntity} from './enitites/album/SavedSearchEntity';
import {IAlbumManager} from '../interfaces/IAlbumManager';

export class AlbumManager implements IAlbumManager {
  public async addIfNotExistSavedSearch(name: string, searchQuery: SearchQueryDTO, lockedAlbum: boolean): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const album = await connection.getRepository(SavedSearchEntity)
      .findOne({name, searchQuery});
    if (album) {
      return;
    }
    await this.addSavedSearch(name, searchQuery, lockedAlbum);
  }

  public async addSavedSearch(name: string, searchQuery: SearchQueryDTO, lockedAlbum?: boolean): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const a = await connection.getRepository(SavedSearchEntity).save({name, searchQuery, locked: lockedAlbum});
    await this.updateAlbum(a);
  }

  public async deleteAlbum(id: number): Promise<void> {
    const connection = await SQLConnection.getConnection();

    if (await connection.getRepository(AlbumBaseEntity)
      .count({id, locked: false}) !== 1) {
      throw new Error('Could not delete album, id:' + id);
    }

    await connection.getRepository(AlbumBaseEntity).delete({id, locked: false});

  }

  public async getAlbums(): Promise<AlbumBaseDTO[]> {
    const connection = await SQLConnection.getConnection();
    return await connection.getRepository(AlbumBaseEntity)
      .createQueryBuilder('album')
      .innerJoin('album.preview', 'preview')
      .innerJoin('preview.directory', 'directory')
      .select(['album', 'preview.name',
        'directory.name',
        'directory.path']).getMany();
  }

  public async onGalleryIndexUpdate(): Promise<void> {
    await this.updateAlbums();
  }


  private async updateAlbums(): Promise<void> {
    const albums = await this.getAlbums();

    for (const a of albums) {
      await this.updateAlbum(a as SavedSearchEntity);
    }
  }

  private async updateAlbum(album: SavedSearchEntity): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const preview = await ObjectManagers.getInstance().PreviewManager
      .getAlbumPreview(album);
    const count = await (ObjectManagers.getInstance().SearchManager as ISQLSearchManager)
      .getCount((album as SavedSearchDTO).searchQuery);

    await connection
      .createQueryBuilder()
      .update(AlbumBaseEntity)
      .set({preview, count})
      .where('id = :id', {id: album.id})
      .execute();
  }

}
