import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser', fullyParallel:false, workers:1, retries:0,
  use:{baseURL:process.env.WEB_URL||'http://127.0.0.1:3000',headless:true,viewport:{width:1440,height:900},trace:'retain-on-failure',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}},
  reporter:'list'
});
