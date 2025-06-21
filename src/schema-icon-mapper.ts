/**
 * Schema Icon Mapper
 * Maps API schemas to appropriate brand icons from simple-icons
 */

import * as vscode from 'vscode';
import * as icons from 'simple-icons';

// Type for simple icons
type SimpleIconsCollection = Record<string, { svg: string; title: string; hex: string }>;

/**
 * Get the icons collection from simple-icons (handles different export formats)
 */
function getIconsCollection(): SimpleIconsCollection {
    // simple-icons v13+ uses 'si' prefix (e.g., siGithub instead of github)
    const iconsModule = (icons as any).default ?? icons;
    
    // If we have the new format with 'si' prefix, convert to old format for backwards compatibility
    if (iconsModule && typeof iconsModule === 'object') {
        const convertedIcons: SimpleIconsCollection = {};
        
        for (const [key, value] of Object.entries(iconsModule)) {
            if (key.startsWith('si') && value && typeof value === 'object' && 'svg' in value) {
                // Convert siGithub -> github
                const simpleName = key.slice(2).toLowerCase();
                convertedIcons[simpleName] = value as { svg: string; title: string; hex: string };
            }
        }
        
        return convertedIcons;
    }
    
    return iconsModule as SimpleIconsCollection;
}

/**
 * Mapping of common API patterns to Simple Icons slugs
 */
const API_ICON_MAPPINGS: Record<string, string> = {
    // Popular APIs
    'github': 'github',
    'gitlab': 'gitlab',
    'stripe': 'stripe',
    'slack': 'slack',
    'discord': 'discord',
    'twitter': 'twitter',
    'facebook': 'facebook',
    'instagram': 'instagram',
    'linkedin': 'linkedin',
    'youtube': 'youtube',
    'google': 'google',
    'microsoft': 'microsoft',
    'azure': 'microsoftazure',
    'aws': 'amazonwebservices',
    'amazon': 'amazon',
    'netflix': 'netflix',
    'spotify': 'spotify',
    'shopify': 'shopify',
    'paypal': 'paypal',
    'twilio': 'twilio',
    'sendgrid': 'sendgrid',
    'mailchimp': 'mailchimp',
    'dropbox': 'dropbox',
    'box': 'box',
    'salesforce': 'salesforce',
    'hubspot': 'hubspot',
    'zendesk': 'zendesk',
    'jira': 'jira',
    'confluence': 'confluence',
    'atlassian': 'atlassian',
    'notion': 'notion',
    'figma': 'figma',
    'adobe': 'adobe',
    'docker': 'docker',
    'kubernetes': 'kubernetes',
    'redis': 'redis',
    'mongodb': 'mongodb',
    'postgresql': 'postgresql',
    'mysql': 'mysql',
    'firebase': 'firebase',
    'supabase': 'supabase',
    'vercel': 'vercel',
    'netlify': 'netlify',
    'heroku': 'heroku',
    'digitalocean': 'digitalocean',
    'cloudflare': 'cloudflare',
    'elasticsearch': 'elasticsearch',
    'kibana': 'elastic', // Elastic Stack
    'grafana': 'grafana',
    'prometheus': 'prometheus',
    'jenkins': 'jenkins',
    'terraform': 'terraform',
    'ansible': 'ansible',
    'vagrant': 'vagrant',
    'postman': 'postman',
    'swagger': 'swagger',
    'openapi': 'openapiinitiative',
    'rest': 'rest',
    'graphql': 'graphql',
    'apollo': 'apollographql',
    'fastapi': 'fastapi',
    'flask': 'flask',
    'django': 'django',
    'express': 'express',
    'nodejs': 'nodedotjs',
    'npm': 'npm',
    'yarn': 'yarn',
    'webpack': 'webpack',
    'vite': 'vite',
    'react': 'react',
    'vue': 'vuedotjs',
    'angular': 'angular',
    'svelte': 'svelte',
    'next': 'nextdotjs',
    'nuxt': 'nuxtdotjs',
    'typescript': 'typescript',
    'javascript': 'javascript',
    'python': 'python',
    'java': 'openjdk',
    'dotnet': 'dotnet',
    'csharp': 'csharp',
    'php': 'php',
    'ruby': 'ruby',
    'go': 'go',
    'rust': 'rust',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'scala': 'scala',
    
    // Generic categories
    'weather': 'weatherapi',
    'payment': 'stripe', // Default to Stripe for payment APIs
    'ecommerce': 'shopify', // Default to Shopify for ecommerce
    'social': 'twitter', // Default to Twitter for social APIs
    'media': 'youtube', // Default to YouTube for media APIs
    'storage': 'amazons3', // Default to S3 for storage APIs
    'database': 'postgresql', // Default to PostgreSQL for database APIs
    'search': 'elasticsearch', // Default to Elasticsearch for search APIs
    'analytics': 'googleanalytics', // Default to Google Analytics
    'messaging': 'slack', // Default to Slack for messaging APIs
    'email': 'gmail', // Default to Gmail for email APIs
    'maps': 'googlemaps', // Default to Google Maps
    'calendar': 'googlecalendar', // Default to Google Calendar
    'crm': 'salesforce', // Default to Salesforce for CRM
    'cms': 'wordpress', // Default to WordPress for CMS
    'blog': 'medium', // Default to Medium for blog APIs
    'news': 'reddit', // Default to Reddit for news APIs
    'finance': 'yahoo', // Default to Yahoo Finance
    'crypto': 'bitcoin', // Default to Bitcoin for crypto APIs
    'iot': 'arduino', // Default to Arduino for IoT APIs
    'ai': 'openai', // Default to OpenAI for AI APIs
    'ml': 'tensorflow', // Default to TensorFlow for ML APIs
    'gaming': 'steam', // Default to Steam for gaming APIs
    'transport': 'uber', // Default to Uber for transport APIs
    'food': 'ubereats', // Default to Uber Eats for food APIs
    'travel': 'airbnb', // Default to Airbnb for travel APIs
    'education': 'coursera', // Default to Coursera for education APIs
    'health': 'fitbit', // Default to Fitbit for health APIs
    'fitness': 'strava', // Default to Strava for fitness APIs
    'music': 'spotify', // Default to Spotify for music APIs
    'video': 'netflix', // Default to Netflix for video APIs
    'books': 'goodreads', // Default to Goodreads for books APIs
    'pets': 'petfinder' // For pet-related APIs
};

/**
 * Extract potential brand names from schema information
 */
function extractBrandKeywords(schema: any): string[] {
    const keywords: string[] = [];
    
    // Get keywords from schema info
    if (schema?.info) {
        const info = schema.info;
        
        // From title
        if (info.title) {
            keywords.push(...info.title.toLowerCase().split(/\s+/));
        }
        
        // From description
        if (info.description) {
            keywords.push(...info.description.toLowerCase().split(/\s+/));
        }
        
        // From contact info
        if (info.contact?.url) {
            const domain = extractDomainFromUrl(info.contact.url);
            if (domain) {
                keywords.push(domain);
            }
        }
        
        // From license
        if (info.license?.name) {
            keywords.push(...info.license.name.toLowerCase().split(/\s+/));
        }
        
        // From version (sometimes contains brand info)
        if (info.version) {
            keywords.push(...info.version.toLowerCase().split(/[\s.-]+/));
        }
    }
    
    // From servers
    if (schema?.servers) {
        for (const server of schema.servers) {
            if (server.url) {
                const domain = extractDomainFromUrl(server.url);
                if (domain) {
                    keywords.push(domain);
                }
            }
            if (server.description) {
                keywords.push(...server.description.toLowerCase().split(/\s+/));
            }
        }
    }
    
    // From tags
    if (schema?.tags) {
        for (const tag of schema.tags) {
            if (tag.name) {
                keywords.push(...tag.name.toLowerCase().split(/\s+/));
            }
            if (tag.description) {
                keywords.push(...tag.description.toLowerCase().split(/\s+/));
            }
        }
    }
    
    // Clean keywords (remove common words, normalize)
    return keywords
        .map(k => k.trim().replace(/[^a-z0-9]/g, ''))
        .filter(k => k.length > 2) // Remove very short words
        .filter(k => !['api', 'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was', 'will', 'been', 'have', 'has', 'can', 'but', 'not', 'all', 'some', 'any', 'may', 'use', 'used', 'new', 'old', 'get', 'set', 'put', 'post', 'delete', 'http', 'https', 'www', 'com', 'org', 'net', 'io', 'dev'].includes(k));
}

/**
 * Extract domain name from URL (e.g., "api.github.com" -> "github")
 */
function extractDomainFromUrl(url: string): string | null {
    try {
        const domain = new URL(url).hostname.toLowerCase();
        
        // Remove common prefixes and suffixes
        let brandName = domain
            .replace(/^(api\.|www\.|dev\.|staging\.|test\.)/, '') // Remove prefixes
            .replace(/\.(com|org|net|io|dev|co\.uk|co)$/, '') // Remove TLDs
            .split('.')[0]; // Take first part if still has dots
        
        return brandName.length > 2 ? brandName : null;
    } catch {
        return null;
    }
}

/**
 * Find the best matching icon for a schema with user override support
 */
export function getSchemaIcon(schema: any, schemaName?: string, schemaSource?: string, schemaConfig?: any): { iconName: string; iconSvg: string; hex?: string } | null {
    const iconsCollection = getIconsCollection();
    
    // Check for user overrides first
    if (schemaConfig?.iconOverride) {
        const override = schemaConfig.iconOverride;
        
        // If user disabled brand icons entirely
        if (override.useBrandIcon === false) {
            return null;
        }
          // If user specified a manual icon
        if (override.manualIconName && iconsCollection[override.manualIconName]) {
            const icon = iconsCollection[override.manualIconName];
            return {
                iconName: override.manualIconName,
                iconSvg: icon.svg,
                hex: icon.hex
            };
        }
    }
    
    // Proceed with automatic detection
    const keywords = extractBrandKeywords(schema);
    
    // Add schema name and source to keywords if provided
    if (schemaName) {
        keywords.push(...schemaName.toLowerCase().split(/\s+/));
    }
    
    if (schemaSource) {
        const sourceKeywords = extractBrandKeywords({ info: { title: schemaSource } });
        keywords.push(...sourceKeywords);
        
        // Also try to extract from source URL/path
        const domain = extractDomainFromUrl(schemaSource);
        if (domain) {
            keywords.push(domain);
        }
    }
      // Look for direct matches in our mapping
    for (const keyword of keywords) {
        const iconSlug = API_ICON_MAPPINGS[keyword];
        if (iconSlug && iconsCollection[iconSlug]) {
            const icon = iconsCollection[iconSlug];
            return {
                iconName: iconSlug,
                iconSvg: icon.svg,
                hex: icon.hex
            };
        }
    }// Look for partial matches in simple-icons (avoid single character matches)
    for (const keyword of keywords) {
        // Only consider keywords that are at least 3 characters to avoid false matches
        if (keyword.length < 3) {
            continue;
        }
        
        const iconSlug = Object.keys(iconsCollection).find(slug => {
            // Avoid very short slugs that might match accidentally 
            if (slug.length < 2) {
                return false;
            }
            // Only exact matches or where slug is at start/end of keyword
            if (slug === keyword) {
                return true;
            }
            // Match if keyword starts or ends with slug (but not in the middle)
            if (slug.length >= 3 && (keyword.startsWith(slug) || keyword.endsWith(slug))) {
                return true;
            }
            // Match if slug contains keyword (for composite brand names)
            return slug.includes(keyword);
        });
          if (iconSlug && iconsCollection[iconSlug]) {
            const icon = iconsCollection[iconSlug];
            return {
                iconName: iconSlug,
                iconSvg: icon.svg,
                hex: icon.hex
            };
        }
    }
    
    // Fallback: try to match by schema pattern/content
    const schemaStr = JSON.stringify(schema).toLowerCase();
    
    // Check for common API patterns
    if (schemaStr.includes('oauth') || schemaStr.includes('authentication')) {
        const authIcon = iconsCollection['auth0'];
        if (authIcon) {
            return { iconName: 'auth0', iconSvg: authIcon.svg, hex: authIcon.hex };
        }
    }
    
    if (schemaStr.includes('webhook') || schemaStr.includes('event')) {
        const webhookIcon = iconsCollection['webhook'];
        if (webhookIcon) {
            return { iconName: 'webhook', iconSvg: webhookIcon.svg, hex: webhookIcon.hex };
        }
    }
    
    if (schemaStr.includes('graphql')) {
        const graphqlIcon = iconsCollection['graphql'];
        if (graphqlIcon) {
            return { iconName: 'graphql', iconSvg: graphqlIcon.svg, hex: graphqlIcon.hex };
        }
    }
    
    // No match found
    return null;
}

/**
 * Convert SVG to themed icons with proper color handling for light/dark modes
 */
export function svgToThemedIcon(svg: string, hexColor: string, iconName: string): { light: string; dark: string } {
    // Convert hex to RGB for brightness calculation
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate relative luminance (perceived brightness)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Create light theme version (use original color)
    const lightSvg = svg.replace(/<svg([^>]*)>/, `<svg$1 fill="#${hex}">`);
    
    // Create dark theme version with better visibility
    let darkColor: string;
    if (luminance < 0.3) {
        // Very dark colors: make them much lighter
        darkColor = lightenColor(hex, 0.7); // Lighten by 70%
    } else if (luminance < 0.5) {
        // Medium dark colors: lighten moderately  
        darkColor = lightenColor(hex, 0.4); // Lighten by 40%
    } else {
        // Light colors: use original or slightly modify
        darkColor = hex;
    }
    
    const darkSvg = svg.replace(/<svg([^>]*)>/, `<svg$1 fill="#${darkColor}">`);
    
    return {
        light: `data:image/svg+xml;base64,${Buffer.from(lightSvg).toString('base64')}`,
        dark: `data:image/svg+xml;base64,${Buffer.from(darkSvg).toString('base64')}`
    };
}

/**
 * Lighten a hex color by a given factor (0-1)
 */
function lightenColor(hex: string, factor: number): string {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    const newR = Math.min(255, Math.round(r + (255 - r) * factor));
    const newG = Math.min(255, Math.round(g + (255 - g) * factor));
    const newB = Math.min(255, Math.round(b + (255 - b) * factor));
    
    return [newR, newG, newB].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert SVG to VS Code tree icon (data URI) - Legacy function for compatibility
 */
export function svgToTreeIcon(svg: string, color?: string): vscode.ThemeIcon {
    // For simple usage, return a ThemeIcon with a fallback
    // VS Code will handle the SVG rendering
    return new vscode.ThemeIcon('file-code', new vscode.ThemeColor('icon.foreground'));
}

/**
 * Get theme-aware icon URIs for a schema (includes both light and dark versions)
 */
export function getSchemaIconThemed(schema: any, schemaName?: string, schemaSource?: string, schemaConfig?: any): { light: string; dark: string; iconName: string } | null {
    const brandIcon = getSchemaIcon(schema, schemaName, schemaSource, schemaConfig);
      if (!brandIcon?.hex) {
        return null;
    }
    
    // Generate theme-aware icons
    const themedIcons = svgToThemedIcon(brandIcon.iconSvg, brandIcon.hex, brandIcon.iconName);
    
    return {
        light: themedIcons.light,
        dark: themedIcons.dark,
        iconName: brandIcon.iconName
    };
}
export function getAvailableBrandIcons(): string[] {
    const iconsCollection = getIconsCollection();
    return Object.keys(iconsCollection).sort((a, b) => a.localeCompare(b));
}

/**
 * Search for icons by keyword
 */
export function searchIcons(keyword: string): Array<{ name: string; title: string; svg: string }> {
    const results: Array<{ name: string; title: string; svg: string }> = [];
    const iconsCollection = getIconsCollection();
    
    for (const [slug, icon] of Object.entries(iconsCollection)) {
        if (icon && typeof icon === 'object' && 'svg' in icon && 'title' in icon) {
            if (slug.includes(keyword.toLowerCase()) || 
                icon.title.toLowerCase().includes(keyword.toLowerCase())) {
                results.push({
                    name: slug,
                    title: icon.title,
                    svg: icon.svg
                });
            }
        }
    }
    
    return results.slice(0, 20); // Limit results
}

/**
 * Get a list of all available icons for UI selection
 */
export function getAllAvailableIcons(): Array<{ slug: string; title: string; svg: string }> {
    const iconsCollection = getIconsCollection();
    
    return Object.entries(iconsCollection)
        .map(([slug, icon]) => ({
            slug,
            title: icon.title,
            svg: icon.svg
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Get popular/recommended icons for quick selection
 */
export function getPopularIcons(): Array<{ slug: string; title: string; svg: string }> {
    const iconsCollection = getIconsCollection();
    
    // List of popular/commonly used API icons
    const popularSlugs = [
        'github', 'gitlab', 'stripe', 'slack', 'discord', 'twitter', 'google', 
        'microsoft', 'microsoftazure', 'amazonwebservices', 'netflix', 'spotify',
        'shopify', 'paypal', 'twilio', 'sendgrid', 'dropbox', 'salesforce',
        'openai', 'docker', 'kubernetes', 'redis', 'mongodb', 'postgresql',
        'mysql', 'elasticsearch', 'graphql', 'swagger', 'postman'
    ];
    
    return popularSlugs
        .filter(slug => iconsCollection[slug])
        .map(slug => ({
            slug,
            title: iconsCollection[slug].title,
            svg: iconsCollection[slug].svg
        }));
}
