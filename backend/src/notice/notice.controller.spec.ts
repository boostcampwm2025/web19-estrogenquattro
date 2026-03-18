import { Test, TestingModule } from '@nestjs/testing';
import { NoticeController } from './notice.controller';
import { NoticeService } from './notice.service';
import { NoticeGateway } from './notice.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../admin/admin.guard';

describe('NoticeController', () => {
  let controller: NoticeController;

  const mockNoticeService = {
    create: jest.fn(),
    findByPage: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    markAsRead: jest.fn(),
    getLatestUnreadNotice: jest.fn(),
  };

  const mockNoticeGateway = {
    broadcastNotice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NoticeController],
      providers: [
        { provide: NoticeService, useValue: mockNoticeService },
        { provide: NoticeGateway, useValue: mockNoticeGateway },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<NoticeController>(NoticeController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create and broadcast a notice', async () => {
      const dto: CreateNotificationDto = {
        ko: { title: '테스트', content: '내용' },
        en: { title: 'Test', content: 'Content' },
      };
      const createdNotice = { id: 1, ...dto, author: { id: 1 } };
      mockNoticeService.create.mockResolvedValue(createdNotice);

      const result = await controller.create(1, dto);

      expect(mockNoticeService.create).toHaveBeenCalledWith(1, dto);
      expect(mockNoticeGateway.broadcastNotice).toHaveBeenCalledWith(
        createdNotice,
      );
      expect(result).toEqual(createdNotice);
    });
  });

  describe('findAll (findByPage)', () => {
    it('should call findByPage with undefined page and limit if undefined is passed', async () => {
      const mockResult = {
        items: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
      };
      mockNoticeService.findByPage.mockResolvedValue(mockResult);

      const result = await controller.findAll(undefined, undefined);

      expect(mockNoticeService.findByPage).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
      expect(result).toEqual(mockResult);
    });

    it('should call findByPage with string page and limit', async () => {
      mockNoticeService.findByPage.mockResolvedValue({
        items: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
      });

      await controller.findAll('2', '10');

      expect(mockNoticeService.findByPage).toHaveBeenCalledWith('2', '10');
    });
  });

  describe('findOne', () => {
    it('should call service.findOne', async () => {
      mockNoticeService.findOne.mockResolvedValue({ id: 1 });
      const result = await controller.findOne(1);
      expect(mockNoticeService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('checkNewNotice', () => {
    it('should return empty object if no new unread notice', async () => {
      mockNoticeService.getLatestUnreadNotice.mockResolvedValue(null);
      const result = await controller.checkNewNotice(1);
      expect(result).toEqual({});
      expect(mockNoticeService.getLatestUnreadNotice).toHaveBeenCalledWith(1);
    });

    it('should return notice object if unread notice exists', async () => {
      const notice = { id: 5, title: 'New!' };
      mockNoticeService.getLatestUnreadNotice.mockResolvedValue(notice);
      const result = await controller.checkNewNotice(1);
      expect(result).toEqual(notice);
    });
  });

  describe('markAsRead', () => {
    it('should call service.markAsRead', async () => {
      await controller.markAsRead(5, 1);
      expect(mockNoticeService.markAsRead).toHaveBeenCalledWith(5, 1);
    });
  });

  describe('update', () => {
    it('should call service.update', async () => {
      const dto: UpdateNotificationDto = { ko: { title: '수정됨' } };
      await controller.update(1, dto);
      expect(mockNoticeService.update).toHaveBeenCalledWith(1, dto);
    });
  });

  describe('remove', () => {
    it('should call service.remove', async () => {
      await controller.remove(1);
      expect(mockNoticeService.remove).toHaveBeenCalledWith(1);
    });
  });
});
