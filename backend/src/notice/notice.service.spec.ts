import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NoticeService } from './notice.service';
import { WriteLockService } from '../database/write-lock.service';
import { Notice } from './entities/notice.entity';
import { NoticeRead } from './entities/notice-read.entity';

describe('NoticeService', () => {
  let service: NoticeService;

  const mockNoticeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockNoticeReadRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockWriteLockService = {
    runExclusive: jest.fn().mockImplementation((cb) => cb()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticeService,
        {
          provide: getRepositoryToken(Notice),
          useValue: mockNoticeRepository,
        },
        {
          provide: getRepositoryToken(NoticeRead),
          useValue: mockNoticeReadRepository,
        },
        {
          provide: WriteLockService,
          useValue: mockWriteLockService,
        },
      ],
    }).compile();

    service = module.get<NoticeService>(NoticeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new notice', async () => {
      const dto = {
        ko: { title: '테스트 제목', content: '테스트 내용' },
        en: { title: 'Test Title', content: 'Test Content' },
      };
      const authorId = 1;
      const createdNotice = {
        id: 1,
        titleKo: dto.ko.title,
        contentKo: dto.ko.content,
        titleEn: dto.en.title,
        contentEn: dto.en.content,
        author: { id: authorId },
      } as unknown as Notice;

      mockNoticeRepository.create.mockReturnValue(createdNotice);
      mockNoticeRepository.save.mockResolvedValue(createdNotice);

      const result = await service.create(authorId, dto);

      expect(mockNoticeRepository.create).toHaveBeenCalledWith({
        titleKo: dto.ko.title,
        contentKo: dto.ko.content,
        titleEn: dto.en.title,
        contentEn: dto.en.content,
        author: { id: authorId },
      });
      expect(mockNoticeRepository.save).toHaveBeenCalledWith(createdNotice);
      expect(result).toEqual(createdNotice);
    });
  });

  describe('findByPage', () => {
    it('should return paginated notices with default page and limit', async () => {
      mockNoticeRepository.findAndCount.mockResolvedValue([
        [{ id: 2 }, { id: 1 }],
        5,
      ]);

      const result = await service.findByPage(undefined, undefined);

      expect(mockNoticeRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['author'],
        select: {
          id: true,
          titleKo: true,
          contentKo: true,
          titleEn: true,
          contentEn: true,
          createdAt: true,
          updatedAt: true,
          author: { nickname: true },
        },
        order: { id: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(5);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(1); // Math.ceil(5 / 20)
    });

    it('should correctly calculate skip, totalPages and limit from provided strings', async () => {
      const mockNotices = [{ id: 4 }, { id: 3 }];
      mockNoticeRepository.findAndCount.mockResolvedValue([mockNotices, 10]);

      const result = await service.findByPage('2', '2'); // page 2, limit 2

      expect(mockNoticeRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 2,
          take: 2,
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(10);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(5); // Math.ceil(10 / 2)
    });

    it('should throw BadRequestException for invalid page', async () => {
      await expect(service.findByPage('0')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByPage('abc')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid limit', async () => {
      await expect(service.findByPage('1', '0')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByPage('1', '51')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByPage('1', 'xyz')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a notice if it exists', async () => {
      const mockNotice = { id: 1, title: 'Test' };
      mockNoticeRepository.findOne.mockResolvedValue(mockNotice);

      const result = await service.findOne(1);
      expect(result).toEqual(mockNotice);
      expect(mockNoticeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['author'],
        select: {
          id: true,
          titleKo: true,
          contentKo: true,
          titleEn: true,
          contentEn: true,
          createdAt: true,
          updatedAt: true,
          author: { nickname: true },
        },
      });
    });

    it('should throw NotFoundException if notice does not exist', async () => {
      mockNoticeRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should save a read record if not exists', async () => {
      mockNoticeRepository.findOne.mockResolvedValue({ id: 1 });
      mockNoticeReadRepository.findOne.mockResolvedValue(null);
      mockNoticeReadRepository.create.mockReturnValue({
        notice: { id: 1 },
        player: { id: 2 },
      });

      await service.markAsRead(1, 2);

      expect(mockNoticeReadRepository.findOne).toHaveBeenCalledWith({
        where: { notice: { id: 1 }, player: { id: 2 } },
      });
      expect(mockNoticeReadRepository.create).toHaveBeenCalledWith({
        notice: { id: 1 },
        player: { id: 2 },
      });
      expect(mockNoticeReadRepository.save).toHaveBeenCalled();
    });

    it('should not save if read record already exists', async () => {
      mockNoticeRepository.findOne.mockResolvedValue({ id: 1 });
      mockNoticeReadRepository.findOne.mockResolvedValue({ id: 1 });

      await service.markAsRead(1, 2);

      expect(mockNoticeReadRepository.create).not.toHaveBeenCalled();
      expect(mockNoticeReadRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getLatestUnreadNotice', () => {
    it('should return null if there are no notices', async () => {
      mockNoticeRepository.findOne.mockResolvedValue(null);
      const result = await service.getLatestUnreadNotice(1);
      expect(result).toBeNull();
    });

    it('should return null if the latest notice is already read', async () => {
      mockNoticeRepository.findOne.mockResolvedValue({ id: 5 });
      mockNoticeReadRepository.findOne.mockResolvedValue({ id: 10 }); // read record exists

      const result = await service.getLatestUnreadNotice(1);
      expect(result).toBeNull();
    });

    it('should return the latest notice if it is unread', async () => {
      const mockLatestNotice = { id: 5, title: 'Unread Notice' };
      mockNoticeRepository.findOne.mockResolvedValue(mockLatestNotice);
      mockNoticeReadRepository.findOne.mockResolvedValue(null); // not read

      const result = await service.getLatestUnreadNotice(1);
      expect(result).toEqual(mockLatestNotice);
      expect(mockNoticeReadRepository.findOne).toHaveBeenCalledWith({
        where: { notice: { id: 5 }, player: { id: 1 } },
      });
    });
  });
});
