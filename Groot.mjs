// #!/usr/bin/env node
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { timeStamp } from 'console';
import { diffLines } from 'diff';
import chalk from 'chalk';
// import { Command } from 'commander';

// const program=new Command();

class Groot{
    constructor(repoPath='.'){
        this.repoPath=path.join(repoPath,'.groot');
        this.objectsPath=path.join(this.repoPath,'objects');  //.groot/object
        this.headPath=path.join(this.repoPath,'HEAD');       //.groot/head
        this.indexPath=path.join(this.repoPath,'index');
        this.init();
    }
    async init(){
        await fs.mkdir(this.objectsPath,{recursive:true});
        try {
            await fs.writeFile(this.headPath,'',{flag:'wx'}); //wx: opens for writing. fails if file exists before.
            await fs.writeFile(this.indexPath,JSON.stringify([]),{flag:'wx'});
        } catch (error) {
            console.log("Already initialized the .groot folder")
        }
    }
    hashObject(content){
        return crypto.createHash('sha1').update(content,'utf-8').digest('hex');
    }
    async add(fileToBeAdded){
        const fileData=await fs.readFile(fileToBeAdded,{encoding:'utf-8'});
        const fileHash=this.hashObject(fileData);
        console.log(fileHash);
        const newFileHashedObjectPath=path.join(this.objectsPath,fileHash);
        await fs.writeFile(newFileHashedObjectPath,fileData);
        await this.updateStagingArea(fileToBeAdded,fileHash);
        //TODO:  One step missing: Add file to the staging area
        console.log(`Added ${fileToBeAdded}`);
    }

    async updateStagingArea(filePath,fileHash){
        const index=JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'})); //Read the index file
        index.push({path:filePath, hash:fileHash}); //Add the file to the index
        await fs.writeFile(this.indexPath,JSON.stringify(index)); // Write the updated index file
    }

    async commit(message){
        const index=JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'}));
        const parentCommit=await this.getCurrentHead();
        
        const commitData={
            timeStamp: new Date().toISOString(),
            message,
            files: index,
            parent: parentCommit
        };

        const commitHash=this.hashObject(JSON.stringify(commitData));
        const commitPath=path.join(this.objectsPath,commitHash);

        await fs.writeFile(commitPath,JSON.stringify(commitData));
        await fs.writeFile(this.headPath,commitHash); // Update the HEAD to the new commit
        await fs.writeFile(this.indexPath,JSON.stringify([])); // Clear the staging area
        console.log(`Commit Successfully Created ${commitHash}`);
    }

    async getCurrentHead(){
        try {
            return await fs.readFile(this.headPath,{encoding:'utf-8'});
        } catch (error) {
            return null;
        }
    }

    async log(){
        let currentCommitHash=await this.getCurrentHead();
        while(currentCommitHash){
            const commitData=JSON.parse(await fs.readFile(path.join(this.objectsPath,currentCommitHash),{encoding:'utf-8'}));
            console.log("_________________________________\n")
            console.log(`Commit: ${currentCommitHash}\nDate: ${commitData.timeStamp}\n\n${commitData.message}\n\n`);
            currentCommitHash=commitData.parent;
        }
    }

    async showCommitDiff(commitHash){
        const commitData=JSON.parse(await this.getCommitData(commitHash));
        if(!commitData){
            console.log("Commit not found");
            return;
        }
        for(const file of commitData.files){
            console.log(`File: ${file.path}`);
            const fileContent=await this.getFileContent(file.hash);
            console.log(fileContent);

            if(commitData.parent){
                //get the parent commit data
                const parentCommitData=JSON.parse(await this.getCommitData(commitData.parent));
                const parentFileContent=await this.getParentFileContent(parentCommitData,file.path);
                if(parentFileContent!=undefined){
                    console.log("\ndiff:");
                    const diff=diffLines(parentFileContent,fileContent);

                    // console.log(diff);
                    diff.forEach(part => {
                        if(part.added){
                            process.stdout.write(chalk.green("++" + part.value));
                        }
                        else if(part.removed){
                            process.stdout.write(chalk.red("--"+part.value));
                        }
                        else{
                            process.stdout.write(chalk.grey(part.value));
                        }
                    });
                    console.log();
                }
                else{
                    console.log("New file is in this commit.");
                }
            }
            else{
                console.log("First commit");
            }
        }
    }

    async getParentFileContent(parentCommitData,filePath){
        const parentFile=parentCommitData.files.find(file => file.path==filePath);
        if(parentFile){
            // get the file content from parent commit and return the content.
            return await this.getFileContent(parentFile.hash);
        }
    }

    async getCommitData(commithash){
        const commitPath=path.join(this.objectsPath,commithash);
        try {
            return await fs.readFile(commitPath,{encoding:'utf-8'});
        } catch (error) {
            console.log("Failed to read the commit data",error);
            return null;
            
        }
    }

    async getFileContent(filehash){
        const objectPath=path.join(this.objectsPath,filehash);
        return fs.readFile(objectPath,{encoding:'utf-8'});
    }
}

(async()=>{
    const groot=new Groot();
    await groot.add('sample.txt');
    await groot.add('sample2.txt');
    await groot.commit('Fourth commit');

    await groot.log();
    await groot.showCommitDiff("a245cc2adc83cb9d190a13d41a627ba9ee34a070");
})();

// program.command('init').action(async()=>{
//     const groot=new Groot();
// });

// program.command('add <file>').action(async(file)=>{
//     const groot=new Groot();
//     await groot.add(file);
// });

// program.command('commit <message>').action(async(message)=>{
//     const groot=new Groot();
//     await groot.commit(message);
// });

// program.command('log').action(async()=>{
//     const groot=new Groot();
//     await groot.log();
// });

// program.command('show <commitHash>').action(async(commitHash)=>{
//     const groot=new Groot();
//     await groot.showCommitDiff(commitHash);
// });
// console.log(process.argv);
// program.parse(process.argv); 
