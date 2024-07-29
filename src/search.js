require('dotenv').config()

const fs = require('fs');
const path = require('path');
const slugify = require('slugify')

const { Gitlab } = require('@gitbeaker/rest');
const api = new Gitlab({
	host: process.env.GITLAB_HOST,
	token: process.env.GITLAB_TOKEN,
});

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
		include_subgroups:false,
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

	const resultFile = path.resolve('./',`search-results__${slugify(process.env.SEARCH_KEYWORD)}.json`);

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
