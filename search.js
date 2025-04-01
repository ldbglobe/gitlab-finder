const commander = require('commander');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const slugify = require('slugify')
const { Gitlab } = require('@gitbeaker/rest');
const { version:softVersion } = require('./package.json');
dotenv.config()

commander.program
.requiredOption('-s, --search <string>','String to search in files')
.option('-p, --pattern <string>', 'File pattern filter (eg. *.php)')  
.option('-g, --group <string>', 'Gitlab group ID to search in')
.option('--include-subgroup', 'When you set a custom group ID, Use this option if you to also search in subgroups')
.option('-d, --delay <number>', 'API rate limiter (default=4000)')
.option('--host <string>', 'Gitlab instance host (default=https://gitlab.com)')
.option('--token <string>', 'Your personnal gitlab token (api_read)')
.name("node search")
.usage("-s test -p \"*.php\"")
.version(softVersion)
.showHelpAfterError();
commander.program.parse();

const options = commander.program.opts();
process.env.SEARCH_KEYWORD = options.search || process.env.SEARCH_KEYWORD || '';
process.env.SEARCH_FILE_PATTERN = options.pattern || process.env.SEARCH_FILE_PATTERN || "*";
process.env.GROUP_ID = options.group || process.env.GROUP_ID || '';
process.env.INCLUDE_SUBGROUP = options.includeSubgroup || process.env.INCLUDE_SUBGROUP || false;
process.env.SEARCH_DELAY = options.delay || process.env.SEARCH_DELAY || 4000;
process.env.GITLAB_HOST = options.host || process.env.GITLAB_HOST || 'https://gitlab.com';
process.env.GITLAB_TOKEN = options.token || process.env.GITLAB_TOKEN || null;

const hash = crypto.createHash('sha256');
hash.update(JSON.stringify({
	SEARCH_KEYWORD: process.env.SEARCH_KEYWORD,
	SEARCH_FILE_PATTERN: process.env.SEARCH_FILE_PATTERN,
	GROUP_ID: process.env.GROUP_ID,
	INCLUDE_SUBGROUP: process.env.INCLUDE_SUBGROUP,
	GITLAB_HOST: process.env.GITLAB_HOST,
	GITLAB_TOKEN: process.env.GITLAB_TOKEN
}));
const searchId = hash.digest('hex').slice(0, 8)+'_'+slugify(process.env.SEARCH_KEYWORD);

__run();

function __run() {
	const api = new Gitlab({
		host: process.env.GITLAB_HOST,
		token: process.env.GITLAB_TOKEN,
	});

	console.log(`Search: ${process.env.GITLAB_HOST}/${process.env.SEARCH_FILE_PATTERN} ? ${process.env.SEARCH_KEYWORD}`,);
	if(process.env.GROUP_ID)
	{
		console.log(`Group: ${process.env.GROUP_ID} ${process.env.INCLUDE_SUBGROUP ? '(*)' : ''}`);
	}
	console.log(`Outputs: search-results_${searchId}.json`);

	async function getGroups()
	{
		return await api.Groups.all({
			perPage:100
		});
	}
	async function getGroupProjects(group)
	{
		return await api.Groups.allProjects(group.id, {
			perPage:100,
			includeSubgroups: process.env.INCLUDE_SUBGROUP || false,
		});
	}

	async function searchInProject(project,search)
	{
		try {
			return await api.Search.all("blobs",search,{
				projectId:project.id,
				perPage:100,
			});
		} catch(e) {
			console.log(e);
			process.exit();
		}
	}

	(async function(){

		
		const resultFile = path.resolve('./',`search-results_${searchId}.json`);

		var searchResults = {};
		if(fs.existsSync(resultFile))
		{
			try {
				searchResults = JSON.parse(fs.readFileSync(resultFile));
			} catch(e) {
			}
		}
		if (!process.env.GROUP_ID) {
			var groups = await getGroups()
		}else{
			var groups = [{id:process.env.GROUP_ID}]
		}
		for(let i=0; i<groups.length; i++)
		{
			let group = groups[i];
			let projects = await getGroupProjects(group);
			for(let j=0; j<projects.length; j++)
			{
				let project = projects[j];
				//console.log(project);process.exit;
				console.log('------------------------------------------------------------');
				console.log(project.name_with_namespace);

				if(searchResults[project.id])
				{
					console.log(' > Allready processed');
					continue;
				}
				else
				{
					searchResults[project.id] = searchResults[project.id] || {
						groupId:group?.id || null,
						groupName:group?.name || null,
						projectId: project.id,
						projectName:project.name_with_namespace,
						chunks:[],
					}
					await new Promise(resolve => setTimeout(resolve, process.env.SEARCH_DELAY));

					let filter = [process.env.SEARCH_KEYWORD]
					if(process.env.SEARCH_FILE_PATTERN && process.env.SEARCH_FILE_PATTERN!='*')
						filter.push('filename:'+process.env.SEARCH_FILE_PATTERN);

					let results = await searchInProject(project,filter.join(' '));
					for(let k=0; k<results.length; k++)
					{
						let element = results[k];
						console.log('+ '+element.path);
						element.data = element.data.replace("\t","  ").split("\n");
						searchResults[project.id].chunks.push(element);
					}
					fs.writeFileSync(resultFile, JSON.stringify(searchResults, null, 2));
				}
			}
		}
	})();
}