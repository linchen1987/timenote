import { describe, test, expect } from 'vitest';
import { URL_REGEX } from '../index';

describe('URL_REGEX', () => {
    test('should match valid URLs', () => {
        const validUrls = [
            'https://www.example.com',
            'http://example.com',
            'www.example.com',
            'https://subdomain.example.com',
            'https://example.com/path',
            'https://example.com/path?param=value',
            'https://example.com/path#section',
            'https://example.com:8080',
            'https://example.com/path-with-dash',
            'https://example.com/path_with_underscore',
            'https://xxx.finance',
        ];

        validUrls.forEach(url => {
            expect(URL_REGEX.test(url)).toBe(true);
        });
    });
});
