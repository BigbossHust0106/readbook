export type Point={x:number;y:number};
export class PageFlip {
 constructor(element:HTMLElement,settings:Record<string,number|string|boolean>);
 loadFromHTML(pages:HTMLElement[]):void;
 flipNext(corner?:'top'|'bottom'):void;
 flipPrev(corner?:'top'|'bottom'):void;
 getCurrentPageIndex():number;
 getState():string;
 getFlipController():{fold(point:Point):void;finishFold(turned:boolean):void};
 getRender():{getRect():{left:number;top:number;width:number;height:number;pageWidth:number};};
 on(name:string,callback:(event:{data:unknown})=>void):void;
 destroy():void;
}
