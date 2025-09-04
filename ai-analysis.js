#!/usr/bin/env node
/**
 * AI Code Analysis System
 * Autonomous code quality analysis and improvement suggestions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class AICodeAnalyzer {
    constructor(options = {}) {
        this.options = {
            maxFiles: 50,
            maxFileSize: 100000, // 100KB
            excludePatterns: [
                'node_modules',
                '.git',
                'dist',
                'build',
                'coverage',
                '.next',
                '.nuxt'
            ],
            languages: {
                '.js': 'javascript',
                '.ts': 'typescript', 
                '.jsx': 'react',
                '.tsx': 'react-typescript',
                '.py': 'python',
                '.sh': 'bash',
                '.md': 'markdown',
                '.json': 'json'
            },
            ...options
        };
        
        this.analysis = {
            timestamp: new Date().toISOString(),
            project: path.basename(process.cwd()),
            files: [],
            issues: [],
            suggestions: [],
            metrics: {},
            aiRecommendations: []
        };
    }

    async analyzeProject(projectPath = '.') {
        console.log('🤖 Starting AI code analysis...');
        
        const files = this.findSourceFiles(projectPath);
        console.log(`Found ${files.length} files to analyze`);
        
        for (const file of files.slice(0, this.options.maxFiles)) {
            await this.analyzeFile(file);
        }
        
        this.generateMetrics();
        this.generateAIRecommendations();
        
        return this.analysis;
    }

    findSourceFiles(dir) {
        const files = [];
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            const relativePath = path.relative('.', fullPath);
            
            // Skip excluded patterns
            if (this.options.excludePatterns.some(pattern => relativePath.includes(pattern))) {
                continue;
            }
            
            if (item.isDirectory()) {
                files.push(...this.findSourceFiles(fullPath));
            } else if (item.isFile()) {
                const ext = path.extname(item.name);
                if (this.options.languages[ext]) {
                    try {
                        const stats = fs.statSync(fullPath);
                        if (stats.size <= this.options.maxFileSize) {
                            files.push({
                                path: relativePath,
                                fullPath,
                                extension: ext,
                                language: this.options.languages[ext],
                                size: stats.size,
                                modified: stats.mtime
                            });
                        }
                    } catch (error) {
                        console.warn(`Warning: Could not analyze ${relativePath}: ${error.message}`);
                    }
                }
            }
        }
        
        return files;
    }

    async analyzeFile(file) {
        try {
            const content = fs.readFileSync(file.fullPath, 'utf8');
            const fileAnalysis = {
                ...file,
                lines: content.split('\n').length,
                characters: content.length,
                hash: crypto.createHash('md5').update(content).digest('hex')
            };
            
            // Code quality analysis
            this.analyzeCodeQuality(file, content);
            
            // Security analysis  
            this.analyzeSecurityIssues(file, content);
            
            // Performance analysis
            this.analyzePerformance(file, content);
            
            // Maintainability analysis
            this.analyzeMaintainability(file, content);
            
            this.analysis.files.push(fileAnalysis);
            
        } catch (error) {
            this.analysis.issues.push({
                file: file.path,
                type: 'file_error',
                severity: 'low',
                message: `Could not analyze file: ${error.message}`
            });
        }
    }

    analyzeCodeQuality(file, content) {
        const lines = content.split('\n');
        
        // Check for debug code
        if (content.includes('console.log') || content.includes('debugger') || content.includes('print(')) {
            this.analysis.issues.push({
                file: file.path,
                type: 'debug_code',
                severity: 'low',
                message: 'Contains debug statements',
                suggestion: 'Remove debug code before production'
            });
        }
        
        // Check for TODO/FIXME
        const todoMatches = content.match(/TODO|FIXME|HACK|XXX/gi);
        if (todoMatches) {
            this.analysis.issues.push({
                file: file.path,
                type: 'todo_comments',
                severity: 'medium',
                message: `Found ${todoMatches.length} TODO/FIXME comments`,
                suggestion: 'Address technical debt items'
            });
        }
        
        // Check file size
        if (lines.length > 300) {
            this.analysis.suggestions.push({
                file: file.path,
                type: 'large_file',
                priority: 'medium',
                message: `Large file (${lines.length} lines)`,
                suggestion: 'Consider splitting into smaller modules'
            });
        }
        
        // Check for long lines
        const longLines = lines.filter(line => line.length > 120);
        if (longLines.length > 5) {
            this.analysis.suggestions.push({
                file: file.path,
                type: 'long_lines',
                priority: 'low',
                message: `${longLines.length} lines exceed 120 characters`,
                suggestion: 'Break long lines for better readability'
            });
        }
    }

    analyzeSecurityIssues(file, content) {
        const securityPatterns = [
            { pattern: /password\s*=\s*["'][^"']+["']/i, issue: 'hardcoded_password' },
            { pattern: /api_?key\s*=\s*["'][^"']+["']/i, issue: 'hardcoded_api_key' },
            { pattern: /secret\s*=\s*["'][^"']+["']/i, issue: 'hardcoded_secret' },
            { pattern: /token\s*=\s*["'][^"']+["']/i, issue: 'hardcoded_token' },
            { pattern: /eval\s*\(/i, issue: 'eval_usage' },
            { pattern: /exec\s*\(/i, issue: 'exec_usage' },
            { pattern: /innerHTML\s*=/i, issue: 'innerHTML_xss' },
        ];
        
        for (const { pattern, issue } of securityPatterns) {
            if (pattern.test(content)) {
                this.analysis.issues.push({
                    file: file.path,
                    type: 'security',
                    subtype: issue,
                    severity: 'high',
                    message: `Potential security issue: ${issue}`,
                    suggestion: 'Review and secure this code'
                });
            }
        }
    }

    analyzePerformance(file, content) {
        if (file.language === 'javascript' || file.language === 'typescript') {
            // Check for inefficient patterns
            if (content.includes('document.getElementById') && content.split('document.getElementById').length > 5) {
                this.analysis.suggestions.push({
                    file: file.path,
                    type: 'performance',
                    priority: 'medium',
                    message: 'Multiple DOM queries detected',
                    suggestion: 'Consider caching DOM elements'
                });
            }
            
            // Check for loops in loops
            const nestedLoops = content.match(/for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/g);
            if (nestedLoops && nestedLoops.length > 0) {
                this.analysis.suggestions.push({
                    file: file.path,
                    type: 'performance',
                    priority: 'high',
                    message: 'Nested loops detected',
                    suggestion: 'Consider optimizing algorithm complexity'
                });
            }
        }
    }

    analyzeMaintainability(file, content) {
        // Check complexity (simplified)
        const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);
        if (cyclomaticComplexity > 10) {
            this.analysis.suggestions.push({
                file: file.path,
                type: 'maintainability',
                priority: 'medium',
                message: `High cyclomatic complexity (${cyclomaticComplexity})`,
                suggestion: 'Consider refactoring into smaller functions'
            });
        }
        
        // Check for duplicate code
        const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{/g);
        if (functionMatches && functionMatches.length > 20) {
            this.analysis.suggestions.push({
                file: file.path,
                type: 'maintainability',
                priority: 'low',
                message: `Many functions in single file (${functionMatches.length})`,
                suggestion: 'Consider splitting into multiple modules'
            });
        }
    }

    calculateCyclomaticComplexity(content) {
        // Simplified cyclomatic complexity calculation
        const complexityKeywords = [
            'if', 'else if', 'while', 'for', 'switch', 'case', 
            'catch', '&&', '\\|\\|', '\\?'
        ];
        
        let complexity = 1; // Base complexity
        
        for (const keyword of complexityKeywords) {
            const matches = content.match(new RegExp(keyword, 'g'));
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }

    generateMetrics() {
        const files = this.analysis.files;
        const issues = this.analysis.issues;
        const suggestions = this.analysis.suggestions;
        
        this.analysis.metrics = {
            totalFiles: files.length,
            totalLines: files.reduce((sum, f) => sum + f.lines, 0),
            totalCharacters: files.reduce((sum, f) => sum + f.characters, 0),
            averageFileSize: Math.round(files.reduce((sum, f) => sum + f.lines, 0) / files.length),
            
            languages: this.getLanguageDistribution(files),
            
            issueCount: issues.length,
            highSeverityIssues: issues.filter(i => i.severity === 'high').length,
            mediumSeverityIssues: issues.filter(i => i.severity === 'medium').length,
            lowSeverityIssues: issues.filter(i => i.severity === 'low').length,
            
            suggestionCount: suggestions.length,
            highPrioritySuggestions: suggestions.filter(s => s.priority === 'high').length,
            
            codeQualityScore: this.calculateQualityScore(),
            maintainabilityIndex: this.calculateMaintainabilityIndex()
        };
    }

    getLanguageDistribution(files) {
        const distribution = {};
        files.forEach(file => {
            distribution[file.language] = (distribution[file.language] || 0) + 1;
        });
        return distribution;
    }

    calculateQualityScore() {
        const issues = this.analysis.issues;
        const totalFiles = this.analysis.files.length;
        
        if (totalFiles === 0) return 100;
        
        const penalty = issues.reduce((sum, issue) => {
            const weights = { high: 3, medium: 2, low: 1 };
            return sum + (weights[issue.severity] || 1);
        }, 0);
        
        return Math.max(0, 100 - (penalty / totalFiles * 10));
    }

    calculateMaintainabilityIndex() {
        // Simplified maintainability index
        const metrics = this.analysis.metrics;
        const avgFileSize = metrics.averageFileSize || 100;
        const issueRatio = metrics.issueCount / metrics.totalFiles;
        
        return Math.max(0, 100 - (avgFileSize / 10) - (issueRatio * 20));
    }

    generateAIRecommendations() {
        const metrics = this.analysis.metrics;
        const recommendations = [];
        
        // Code quality recommendations
        if (metrics.codeQualityScore < 80) {
            recommendations.push({
                type: 'code_quality',
                priority: 'high',
                title: 'Improve Code Quality',
                description: `Code quality score is ${Math.round(metrics.codeQualityScore)}/100`,
                actions: [
                    'Address high-severity issues first',
                    'Set up automated code formatting',
                    'Implement code review process',
                    'Add unit tests for critical functions'
                ]
            });
        }
        
        // Performance recommendations
        if (metrics.highPrioritySuggestions > 0) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                title: 'Performance Optimizations Available',
                description: `${metrics.highPrioritySuggestions} high-priority performance improvements found`,
                actions: [
                    'Review nested loops and algorithm complexity',
                    'Implement caching where appropriate',
                    'Consider code splitting for large files',
                    'Profile performance-critical sections'
                ]
            });
        }
        
        // Security recommendations
        const securityIssues = this.analysis.issues.filter(i => i.type === 'security');
        if (securityIssues.length > 0) {
            recommendations.push({
                type: 'security',
                priority: 'critical',
                title: 'Security Issues Detected',
                description: `${securityIssues.length} potential security issues found`,
                actions: [
                    'Remove hardcoded secrets immediately',
                    'Implement environment variable management',
                    'Add security scanning to CI/CD pipeline',
                    'Review input validation and sanitization'
                ]
            });
        }
        
        // Maintainability recommendations
        if (metrics.maintainabilityIndex < 70) {
            recommendations.push({
                type: 'maintainability',
                priority: 'medium',
                title: 'Improve Code Maintainability',
                description: `Maintainability index is ${Math.round(metrics.maintainabilityIndex)}/100`,
                actions: [
                    'Refactor large functions into smaller ones',
                    'Add comprehensive documentation',
                    'Implement consistent code style',
                    'Reduce code duplication'
                ]
            });
        }
        
        this.analysis.aiRecommendations = recommendations;
    }

    generateReport() {
        const report = {
            summary: {
                project: this.analysis.project,
                timestamp: this.analysis.timestamp,
                filesAnalyzed: this.analysis.metrics.totalFiles,
                issuesFound: this.analysis.metrics.issueCount,
                suggestionsGenerated: this.analysis.metrics.suggestionCount,
                qualityScore: Math.round(this.analysis.metrics.codeQualityScore),
                maintainabilityScore: Math.round(this.analysis.metrics.maintainabilityIndex)
            },
            recommendations: this.analysis.aiRecommendations,
            topIssues: this.analysis.issues
                .filter(i => i.severity === 'high')
                .slice(0, 10),
            quickWins: this.analysis.suggestions
                .filter(s => s.priority === 'low')
                .slice(0, 5)
        };
        
        return report;
    }

    async saveResults(outputFile = 'ai-analysis-results.json') {
        const fullAnalysis = {
            ...this.analysis,
            report: this.generateReport()
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(fullAnalysis, null, 2));
        console.log(`📊 Analysis results saved to ${outputFile}`);
        
        return fullAnalysis;
    }
}

// CLI usage
async function main() {
    const analyzer = new AICodeAnalyzer();
    
    try {
        const results = await analyzer.analyzeProject();
        const report = analyzer.generateReport();
        
        console.log('\n📊 AI Code Analysis Report');
        console.log('========================');
        console.log(`Project: ${report.summary.project}`);
        console.log(`Files analyzed: ${report.summary.filesAnalyzed}`);
        console.log(`Issues found: ${report.summary.issuesFound}`);
        console.log(`Quality score: ${report.summary.qualityScore}/100`);
        console.log(`Maintainability score: ${report.summary.maintainabilityScore}/100`);
        
        if (report.recommendations.length > 0) {
            console.log('\n🎯 Top Recommendations:');
            report.recommendations.slice(0, 3).forEach((rec, i) => {
                console.log(`${i + 1}. ${rec.title} (${rec.priority} priority)`);
                console.log(`   ${rec.description}`);
            });
        }
        
        if (report.topIssues.length > 0) {
            console.log('\n🔥 Critical Issues:');
            report.topIssues.slice(0, 5).forEach((issue, i) => {
                console.log(`${i + 1}. ${issue.file}: ${issue.message}`);
            });
        }
        
        await analyzer.saveResults();
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

// Export for use as module
module.exports = AICodeAnalyzer;

// Run if called directly
if (require.main === module) {
    main();
}