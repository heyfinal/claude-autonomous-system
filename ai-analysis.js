#!/usr/bin/env node
/**
 * AI Code Analysis System
 * Autonomous code quality analysis and improvement suggestions
 * Part of Claude Autonomous Development System
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
                '.nuxt',
                '.cache',
                'temp',
                'tmp'
            ],
            languages: {
                '.js': 'javascript',
                '.ts': 'typescript', 
                '.jsx': 'react',
                '.tsx': 'react-typescript',
                '.py': 'python',
                '.sh': 'bash',
                '.md': 'markdown',
                '.json': 'json',
                '.yaml': 'yaml',
                '.yml': 'yaml'
            },
            ...options
        };
        
        this.analysis = {
            timestamp: new Date().toISOString(),
            project: path.basename(process.cwd()),
            version: '2.0.0',
            files: [],
            issues: [],
            suggestions: [],
            metrics: {},
            aiRecommendations: [],
            securityScan: {
                vulnerabilities: [],
                recommendations: []
            }
        };
    }

    async analyzeProject(projectPath = '.') {
        console.log('🤖 Starting AI code analysis...');
        
        const startTime = Date.now();
        const files = this.findSourceFiles(projectPath);
        console.log(`Found ${files.length} files to analyze`);
        
        // Analyze files in batches for better performance
        const batchSize = 10;
        for (let i = 0; i < Math.min(files.length, this.options.maxFiles); i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            await Promise.all(batch.map(file => this.analyzeFile(file)));
        }
        
        this.generateMetrics();
        this.performSecurityScan();
        this.generateAIRecommendations();
        
        const endTime = Date.now();
        this.analysis.processingTime = endTime - startTime;
        
        console.log(`✅ Analysis completed in ${(this.analysis.processingTime / 1000).toFixed(2)}s`);
        
        return this.analysis;
    }

    findSourceFiles(dir) {
        const files = [];
        
        try {
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
        } catch (error) {
            console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
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
                hash: crypto.createHash('md5').update(content).digest('hex'),
                analyzed: new Date().toISOString()
            };
            
            // Comprehensive analysis
            this.analyzeCodeQuality(file, content);
            this.analyzeSecurityIssues(file, content);
            this.analyzePerformance(file, content);
            this.analyzeMaintainability(file, content);
            this.analyzeDependencies(file, content);
            
            this.analysis.files.push(fileAnalysis);
            
        } catch (error) {
            this.analysis.issues.push({
                file: file.path,
                type: 'file_error',
                severity: 'low',
                message: `Could not analyze file: ${error.message}`,
                category: 'accessibility'
            });
        }
    }

    analyzeCodeQuality(file, content) {
        const lines = content.split('\n');
        
        // Check for debug code
        const debugPatterns = [
            /console\.log\(/g,
            /debugger[;\s]/g,
            /print\(/g,
            /console\.debug\(/g,
            /alert\(/g
        ];
        
        debugPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                this.analysis.issues.push({
                    file: file.path,
                    type: 'debug_code',
                    severity: 'low',
                    message: 'Contains debug statements',
                    suggestion: 'Remove debug code before production',
                    category: 'code_quality'
                });
            }
        });
        
        // Check for TODO/FIXME/HACK comments
        const todoMatches = content.match(/TODO|FIXME|HACK|XXX|BUG/gi);
        if (todoMatches) {
            this.analysis.issues.push({
                file: file.path,
                type: 'technical_debt',
                severity: 'medium',
                message: `Found ${todoMatches.length} technical debt comments`,
                suggestion: 'Address technical debt items',
                category: 'maintainability'
            });
        }
        
        // Check file size
        if (lines.length > 300) {
            this.analysis.suggestions.push({
                file: file.path,
                type: 'large_file',
                priority: 'medium',
                message: `Large file (${lines.length} lines)`,
                suggestion: 'Consider splitting into smaller modules',
                category: 'maintainability'
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
                suggestion: 'Break long lines for better readability',
                category: 'formatting'
            });
        }
        
        // Check for empty catch blocks
        if (content.includes('catch') && /catch\s*\([^)]*\)\s*{\s*}/g.test(content)) {
            this.analysis.issues.push({
                file: file.path,
                type: 'empty_catch',
                severity: 'medium',
                message: 'Empty catch block detected',
                suggestion: 'Add proper error handling',
                category: 'error_handling'
            });
        }
    }

    analyzeSecurityIssues(file, content) {
        const securityPatterns = [
            { pattern: /password\s*=\s*["'][^"']+["']/gi, issue: 'hardcoded_password', severity: 'critical' },
            { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/gi, issue: 'hardcoded_api_key', severity: 'critical' },
            { pattern: /secret\s*=\s*["'][^"']+["']/gi, issue: 'hardcoded_secret', severity: 'critical' },
            { pattern: /token\s*=\s*["'][^"']+["']/gi, issue: 'hardcoded_token', severity: 'critical' },
            { pattern: /eval\s*\(/gi, issue: 'eval_usage', severity: 'high' },
            { pattern: /exec\s*\(/gi, issue: 'exec_usage', severity: 'high' },
            { pattern: /innerHTML\s*=/gi, issue: 'innerHTML_xss', severity: 'medium' },
            { pattern: /document\.write\s*\(/gi, issue: 'document_write_xss', severity: 'medium' },
            { pattern: /sql.*\+.*\+/gi, issue: 'sql_injection_risk', severity: 'high' }
        ];
        
        for (const { pattern, issue, severity } of securityPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                this.analysis.securityScan.vulnerabilities.push({
                    file: file.path,
                    type: 'security_vulnerability',
                    subtype: issue,
                    severity,
                    count: matches.length,
                    message: `Potential security issue: ${issue}`,
                    suggestion: this.getSecuritySuggestion(issue),
                    category: 'security'
                });
            }
        }
    }

    getSecuritySuggestion(issue) {
        const suggestions = {
            'hardcoded_password': 'Move passwords to environment variables or secure configuration',
            'hardcoded_api_key': 'Store API keys in environment variables or secure key management',
            'hardcoded_secret': 'Use secure configuration management for secrets',
            'hardcoded_token': 'Store tokens securely using environment variables',
            'eval_usage': 'Avoid using eval() - use safer alternatives like JSON.parse()',
            'exec_usage': 'Validate and sanitize input before using exec functions',
            'innerHTML_xss': 'Use textContent or sanitize HTML input to prevent XSS',
            'document_write_xss': 'Use DOM manipulation instead of document.write',
            'sql_injection_risk': 'Use parameterized queries to prevent SQL injection'
        };
        
        return suggestions[issue] || 'Review and secure this code pattern';
    }

    analyzePerformance(file, content) {
        if (file.language === 'javascript' || file.language === 'typescript') {
            // Check for inefficient DOM queries
            const domQueryCount = (content.match(/document\.getElementById|document\.querySelector/g) || []).length;
            if (domQueryCount > 5) {
                this.analysis.suggestions.push({
                    file: file.path,
                    type: 'dom_performance',
                    priority: 'medium',
                    message: `${domQueryCount} DOM queries detected`,
                    suggestion: 'Consider caching DOM elements or using more efficient selectors',
                    category: 'performance'
                });
            }
            
            // Check for nested loops
            const nestedLoops = content.match(/for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/g);
            if (nestedLoops && nestedLoops.length > 0) {
                this.analysis.suggestions.push({
                    file: file.path,
                    type: 'algorithm_performance',
                    priority: 'high',
                    message: `${nestedLoops.length} nested loop patterns detected`,
                    suggestion: 'Consider optimizing algorithm complexity (O(n²) → O(n))',
                    category: 'performance'
                });
            }
            
            // Check for synchronous operations that could be async
            if (content.includes('readFileSync') || content.includes('execSync')) {
                this.analysis.suggestions.push({
                    file: file.path,
                    type: 'async_performance',
                    priority: 'medium',
                    message: 'Synchronous operations detected',
                    suggestion: 'Consider using async alternatives for better performance',
                    category: 'performance'
                });
            }
        }
    }

    analyzeMaintainability(file, content) {
        // Calculate cyclomatic complexity
        const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);
        if (cyclomaticComplexity > 10) {
            this.analysis.suggestions.push({
                file: file.path,
                type: 'complexity',
                priority: 'medium',
                message: `High cyclomatic complexity (${cyclomaticComplexity})`,
                suggestion: 'Consider refactoring into smaller, more focused functions',
                category: 'maintainability'
            });
        }
        
        // Check for duplicate code patterns
        const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{/g);
        if (functionMatches && functionMatches.length > 15) {
            this.analysis.suggestions.push({
                file: file.path,
                type: 'function_density',
                priority: 'low',
                message: `High function density (${functionMatches.length} functions)`,
                suggestion: 'Consider splitting into multiple modules for better organization',
                category: 'maintainability'
            });
        }
        
        // Check for missing documentation
        if (file.language !== 'markdown' && content.length > 1000) {
            const commentRatio = (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).join('').length / content.length;
            if (commentRatio < 0.05) {
                this.analysis.suggestions.push({
                    file: file.path,
                    type: 'documentation',
                    priority: 'low',
                    message: 'Low comment-to-code ratio',
                    suggestion: 'Add more documentation and comments for better maintainability',
                    category: 'documentation'
                });
            }
        }
    }

    analyzeDependencies(file, content) {
        if (file.path === 'package.json') {
            try {
                const packageData = JSON.parse(content);
                const allDeps = { ...packageData.dependencies, ...packageData.devDependencies };
                
                // Check for outdated or risky dependencies
                const riskyPackages = ['lodash', 'moment', 'request'];
                for (const pkg of riskyPackages) {
                    if (allDeps[pkg]) {
                        this.analysis.suggestions.push({
                            file: file.path,
                            type: 'dependency_risk',
                            priority: 'medium',
                            message: `Consider updating ${pkg}`,
                            suggestion: this.getDependencyAlternative(pkg),
                            category: 'dependencies'
                        });
                    }
                }
            } catch (error) {
                // Invalid JSON, skip dependency analysis
            }
        }
    }

    getDependencyAlternative(pkg) {
        const alternatives = {
            'lodash': 'Consider native JS methods or tree-shake specific functions',
            'moment': 'Consider date-fns or dayjs for smaller bundle size',
            'request': 'Use fetch API or axios (request is deprecated)'
        };
        
        return alternatives[pkg] || 'Check for more modern alternatives';
    }

    calculateCyclomaticComplexity(content) {
        const complexityKeywords = [
            'if', 'else if', 'while', 'for', 'switch', 'case', 
            'catch', '&&', '\\|\\|', '\\?', 'forEach', 'map', 'filter'
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

    performSecurityScan() {
        const vulnerabilities = this.analysis.securityScan.vulnerabilities;
        
        if (vulnerabilities.length > 0) {
            const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
            const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
            
            this.analysis.securityScan.recommendations.push({
                priority: 'critical',
                title: 'Security Vulnerabilities Detected',
                description: `Found ${criticalCount} critical and ${highCount} high-severity security issues`,
                actions: [
                    'Address critical security vulnerabilities immediately',
                    'Implement secure coding practices',
                    'Use environment variables for sensitive data',
                    'Add security scanning to CI/CD pipeline'
                ]
            });
        }
    }

    generateMetrics() {
        const files = this.analysis.files;
        const issues = this.analysis.issues;
        const suggestions = this.analysis.suggestions;
        const vulnerabilities = this.analysis.securityScan.vulnerabilities;
        
        this.analysis.metrics = {
            // Basic metrics
            totalFiles: files.length,
            totalLines: files.reduce((sum, f) => sum + (f.lines || 0), 0),
            totalCharacters: files.reduce((sum, f) => sum + (f.characters || 0), 0),
            averageFileSize: files.length > 0 ? Math.round(files.reduce((sum, f) => sum + (f.lines || 0), 0) / files.length) : 0,
            
            // Language distribution
            languages: this.getLanguageDistribution(files),
            
            // Issue metrics
            issueCount: issues.length,
            criticalIssues: issues.filter(i => i.severity === 'critical').length,
            highSeverityIssues: issues.filter(i => i.severity === 'high').length,
            mediumSeverityIssues: issues.filter(i => i.severity === 'medium').length,
            lowSeverityIssues: issues.filter(i => i.severity === 'low').length,
            
            // Security metrics
            securityVulnerabilities: vulnerabilities.length,
            criticalVulnerabilities: vulnerabilities.filter(v => v.severity === 'critical').length,
            
            // Suggestion metrics
            suggestionCount: suggestions.length,
            highPrioritySuggestions: suggestions.filter(s => s.priority === 'high').length,
            mediumPrioritySuggestions: suggestions.filter(s => s.priority === 'medium').length,
            
            // Quality scores
            codeQualityScore: this.calculateQualityScore(),
            maintainabilityIndex: this.calculateMaintainabilityIndex(),
            securityScore: this.calculateSecurityScore()
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
            const weights = { critical: 5, high: 3, medium: 2, low: 1 };
            return sum + (weights[issue.severity] || 1);
        }, 0);
        
        return Math.max(0, Math.round(100 - (penalty / totalFiles * 8)));
    }

    calculateMaintainabilityIndex() {
        const files = this.analysis.files;
        const issues = this.analysis.issues;
        
        if (files.length === 0) return 0;
        
        const avgFileSize = files.reduce((sum, f) => sum + (f.lines || 0), 0) / files.length;
        const issueRatio = issues.length / files.length;
        const complexityPenalty = Math.min(avgFileSize / 15, 10); // Cap penalty at 10
        
        return Math.max(0, Math.round(100 - complexityPenalty - (issueRatio * 15)));
    }

    calculateSecurityScore() {
        const vulnerabilities = this.analysis.securityScan.vulnerabilities;
        
        if (vulnerabilities.length === 0) return 100;
        
        const penalty = vulnerabilities.reduce((sum, vuln) => {
            const weights = { critical: 20, high: 10, medium: 5, low: 2 };
            return sum + (weights[vuln.severity] || 1);
        }, 0);
        
        return Math.max(0, 100 - penalty);
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
                description: `Code quality score is ${metrics.codeQualityScore}/100`,
                impact: 'High',
                effort: 'Medium',
                actions: [
                    'Address high-severity issues first',
                    'Implement automated code formatting (Prettier/ESLint)',
                    'Add pre-commit hooks for quality checks',
                    'Establish code review process'
                ]
            });
        }
        
        // Security recommendations
        if (metrics.securityVulnerabilities > 0) {
            recommendations.push({
                type: 'security',
                priority: 'critical',
                title: 'Security Vulnerabilities Detected',
                description: `${metrics.securityVulnerabilities} security issues found, ${metrics.criticalVulnerabilities} critical`,
                impact: 'Critical',
                effort: 'High',
                actions: [
                    'Fix critical vulnerabilities immediately',
                    'Implement secure coding practices',
                    'Use environment variables for secrets',
                    'Add security scanning to CI pipeline',
                    'Regular security audits'
                ]
            });
        }
        
        // Performance recommendations
        if (metrics.highPrioritySuggestions > 0) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                title: 'Performance Optimizations Available',
                description: `${metrics.highPrioritySuggestions} high-priority performance improvements identified`,
                impact: 'Medium',
                effort: 'Medium',
                actions: [
                    'Optimize nested loops and algorithm complexity',
                    'Implement efficient caching strategies',
                    'Use async operations where possible',
                    'Consider code splitting for large files'
                ]
            });
        }
        
        // Maintainability recommendations
        if (metrics.maintainabilityIndex < 70) {
            recommendations.push({
                type: 'maintainability',
                priority: 'medium',
                title: 'Improve Code Maintainability',
                description: `Maintainability index is ${metrics.maintainabilityIndex}/100`,
                impact: 'Medium',
                effort: 'Low',
                actions: [
                    'Break large functions into smaller ones',
                    'Add comprehensive documentation',
                    'Implement consistent coding standards',
                    'Reduce code duplication'
                ]
            });
        }
        
        // Add best practices recommendation
        recommendations.push({
            type: 'best_practices',
            priority: 'low',
            title: 'Development Best Practices',
            description: 'General recommendations for better development workflow',
            impact: 'Low',
            effort: 'Low',
            actions: [
                'Set up automated testing',
                'Implement continuous integration',
                'Use version control best practices',
                'Regular dependency updates'
            ]
        });
        
        this.analysis.aiRecommendations = recommendations;
    }

    generateReport() {
        const report = {
            summary: {
                project: this.analysis.project,
                timestamp: this.analysis.timestamp,
                version: this.analysis.version,
                processingTime: this.analysis.processingTime,
                filesAnalyzed: this.analysis.metrics.totalFiles,
                issuesFound: this.analysis.metrics.issueCount,
                suggestionsGenerated: this.analysis.metrics.suggestionCount,
                qualityScore: this.analysis.metrics.codeQualityScore,
                maintainabilityScore: this.analysis.metrics.maintainabilityIndex,
                securityScore: this.analysis.metrics.securityScore
            },
            recommendations: this.analysis.aiRecommendations,
            topIssues: [...this.analysis.issues, ...this.analysis.securityScan.vulnerabilities]
                .filter(i => i.severity === 'critical' || i.severity === 'high')
                .slice(0, 10),
            quickWins: this.analysis.suggestions
                .filter(s => s.priority === 'low')
                .slice(0, 5),
            metrics: this.analysis.metrics
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
        
        // Display enhanced report
        console.log('\n📊 AI Code Analysis Report');
        console.log('════════════════════════════');
        console.log(`Project: ${report.summary.project}`);
        console.log(`Files analyzed: ${report.summary.filesAnalyzed}`);
        console.log(`Processing time: ${(report.summary.processingTime / 1000).toFixed(2)}s`);
        console.log(`Issues found: ${report.summary.issuesFound}`);
        console.log(`Quality score: ${report.summary.qualityScore}/100`);
        console.log(`Maintainability: ${report.summary.maintainabilityScore}/100`);
        console.log(`Security score: ${report.summary.securityScore}/100`);
        
        if (report.recommendations.length > 0) {
            console.log('\n🎯 Top Recommendations:');
            report.recommendations.slice(0, 3).forEach((rec, i) => {
                console.log(`${i + 1}. ${rec.title} (${rec.priority} priority)`);
                console.log(`   Impact: ${rec.impact} | Effort: ${rec.effort}`);
                console.log(`   ${rec.description}`);
            });
        }
        
        if (report.topIssues.length > 0) {
            console.log('\n🔥 Critical Issues:');
            report.topIssues.slice(0, 5).forEach((issue, i) => {
                console.log(`${i + 1}. ${issue.file}: ${issue.message} (${issue.severity})`);
            });
        }
        
        await analyzer.saveResults();
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Export for use as module
module.exports = AICodeAnalyzer;

// Run if called directly
if (require.main === module) {
    main();
}