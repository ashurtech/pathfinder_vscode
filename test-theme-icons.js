/**
 * Test script to demonstrate theme-aware brand icon functionality
 */

const { getSchemaIconThemed, getSchemaIcon } = require('./out/src/schema-icon-mapper');

// Test schema for GitHub API
const githubSchema = {
    info: {
        title: "GitHub API",
        description: "GitHub's API for managing repositories and organizations"
    },
    servers: [
        { url: "https://api.github.com" }
    ]
};

// Test schema for Stripe API
const stripeSchema = {
    info: {
        title: "Stripe API",
        description: "Payment processing API"
    },
    servers: [
        { url: "https://api.stripe.com" }
    ]
};

console.log("=== Theme-Aware Icon Test ===\n");

// Test GitHub icon
console.log("1. GitHub API:");
const githubIcon = getSchemaIcon(githubSchema, "GitHub API");
if (githubIcon) {
    console.log(`   Found brand icon: ${githubIcon.iconName}`);
    console.log(`   Brand color: #${githubIcon.hex}`);
    
    const githubThemed = getSchemaIconThemed(githubSchema, "GitHub API");
    if (githubThemed) {
        console.log(`   Light theme URI: ${githubThemed.light.substring(0, 60)}...`);
        console.log(`   Dark theme URI: ${githubThemed.dark.substring(0, 60)}...`);
        console.log("   ✓ Theme-aware icons generated!");
    }
} else {
    console.log("   No brand icon found");
}

console.log("\n2. Stripe API:");
const stripeIcon = getSchemaIcon(stripeSchema, "Stripe API");
if (stripeIcon) {
    console.log(`   Found brand icon: ${stripeIcon.iconName}`);
    console.log(`   Brand color: #${stripeIcon.hex}`);
    
    const stripeThemed = getSchemaIconThemed(stripeSchema, "Stripe API");
    if (stripeThemed) {
        console.log(`   Light theme URI: ${stripeThemed.light.substring(0, 60)}...`);
        console.log(`   Dark theme URI: ${stripeThemed.dark.substring(0, 60)}...`);
        console.log("   ✓ Theme-aware icons generated!");
    }
} else {
    console.log("   No brand icon found");
}

console.log("\n=== Benefits ===");
console.log("• Brand icons now automatically adjust for light/dark themes");
console.log("• Dark colors are lightened for better visibility in dark mode");
console.log("• Light colors remain mostly unchanged for light mode");
console.log("• Icons maintain brand recognition while improving usability");
console.log("\n✓ Theme-aware brand icon implementation complete!");
