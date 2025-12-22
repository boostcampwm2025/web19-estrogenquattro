import { Controller, Get, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/github-profile/:username')
  async getGithubProfile(
    @Param('username') username: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const githubUrl = `https://github.com/${username}.png`;
      const response = await fetch(githubUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!response.ok) {
        res.status(response.status).send(`GitHub Error: ${response.status}`);
        return;
      }

      const imageBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('Content-Type') || 'image/png';

      res.set({
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      });

      res.send(Buffer.from(imageBuffer));
    } catch (error) {
      console.error('GitHub Profile Proxy Error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
